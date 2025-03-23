<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { defineStore } from 'pinia'
import type { Client } from '@/types/Clients'
import type { ListResponse } from '@/plugins/llana'

const { $llanaAuthCheck, $llanaLogin, $llanaGetProfile, $llanaAccessToken, $llanaSubscribe, $llana } = useNuxtApp()

const table = 'User'

const isAuthed = ref<boolean | null>(null)
const form = ref<{ email: string, password: string }>({ email: '', password: '' })
const loginError = ref<string | null>(null)
const profile = ref<Profile | null>(null)
const headers = ref({ Authorization: '' })
const clients = ref<ListResponse<Client>>({ data: [], meta: {} })

const newUser = ref<{ email: string, password: string, role: string, firstName: string, lastName: string }>({
	email: '',
	password: '',
	role: 'ADMIN',
	firstName: '',
	lastName: ''
})

const checkAuth = async () => {
	isAuthed.value = await $llanaAuthCheck()
}

const login = async () => {
	try {
		const response = await $llanaLogin({
			username: form.value.email,
			password: form.value.password
		})
		if (response.status == 200) {
			isAuthed.value = true
			loginError.value = null
			await fetchProfile()
			headers.value.Authorization = 'Bearer ' + $llanaAccessToken
			await clientsStore.listClients()
			subscribeToUpdates()
		} else {
			loginError.value = 'Login failed'
		}
	} catch (error) {
		loginError.value = 'Login failed'
	}
}

const fetchProfile = async () => {
	profile.value = (await $llanaGetProfile<Profile>()) as Profile
}
const useClientsStore = defineStore('clientsStore', {
	state: (): ListResponse<Client> => ({
		data: [],
		meta: {},
	}),
	actions: {
		async listClients(force: boolean = false): Promise<ListResponse<Client>> {
			if (!force && this.data.length > 0) {
				return this.$state
			}
			this.$state = (await $llana<Client>({ type: 'LIST', table: 'User' })) as ListResponse<Client>
			return this.$state
		},
	}
})

const clientsStore = useClientsStore()

const createUser = async () => {
	try {
		const response = await $llana({
			type: 'CREATE',
			table,
			data: newUser.value
		})
		if (response.status == 201) {
			await clientsStore.listClients(true)
		} else {
			console.error('User creation failed')
		}
	} catch (error) {
		console.error('User creation failed', error)
	}
}

const subscribeToUpdates = () => {
	$llanaSubscribe(table, (data: SocketData) => clientsStore.listClients(true), (data: SocketData) => clientsStore.listClients(true), (data: SocketData) => clientsStore.listClients(true))
}

onMounted(async () => {
	await checkAuth()
	if (isAuthed.value) {
		await fetchProfile()
		headers.value.Authorization = 'Bearer ' + $llanaAccessToken
	}
})
</script>
<template>
	<div>
		<h1>Nuxt Module Playground</h1>

		<ClientOnly>
			<div v-if="isAuthed === null">Checking authentication...</div>
			<div v-else-if="isAuthed">Authenticated</div>
			<div v-else>Not Authenticated</div>

			<button @click="checkAuth">Check Auth</button>

			<form @submit.prevent="login">
				<input v-model="form.email" type="email" placeholder="Email" required />
				<input v-model="form.password" type="password" placeholder="Password" required />
				<button type="submit">Login</button>
			</form>

			<div v-if="loginError">{{ loginError }}</div>

			<div v-if="profile">
				<h2>Profile</h2>
				<p>Name: {{ profile.name }}</p>
				<p>Email: {{ profile.email }}</p>
			</div>

			<div>
				<h2>Clients</h2>
				<ul>
					<li v-for="client in clientsStore.data" :key="client.id">{{ client.email }}</li>
				</ul>
			</div>

			<div>
				<h2>Create User</h2>
				<form @submit.prevent="createUser">
					<input v-model="newUser.email" type="email" placeholder="Email" required />
					<input v-model="newUser.password" type="password" placeholder="Password" required />
					<input v-model="newUser.firstName" type="text" placeholder="First Name" required />
					<input v-model="newUser.lastName" type="text" placeholder="Last Name" required />
					<button type="submit">Create User</button>
				</form>
			</div>
		</ClientOnly>
	</div>
</template>