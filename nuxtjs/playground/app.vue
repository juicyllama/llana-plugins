<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { defineStore } from 'pinia'
import type { Client } from '@/types/Clients'
import type { ListResponse } from '@/plugins/llana'

const { $llanaAuthCheck, $llanaLogin, $llanaGetProfile, $llanaSubscribe, $llanaLogout, $llana } = useNuxtApp()

const table = 'User'

const isAuthed = ref<boolean | null>(null)
const form = ref<{ email: string, password: string }>({ email: '', password: '' })
const loginError = ref<string | null>(null)
const profile = ref<Profile | null>(null)

const newUser = ref<{ email: string, password: string, role: string, firstName: string, lastName: string }>({
	email: '',
	password: '',
	role: 'ADMIN',
	firstName: '',
	lastName: ''
})

const checkAuth = () => {
	isAuthed.value = $llanaAuthCheck()
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
			await refetchUsers()
			subscribeToUpdates()
		} else {
			loginError.value = 'Login failed'
		}
	} catch (error) {
		loginError.value = 'Login failed'
	}
}

const logout = async () => {
	try {
		await $llanaLogout()
		isAuthed.value = false
		profile.value = null
		clientsStore.$reset()
	} catch (error) {
		console.error('Logout failed', error)
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
	const onSocketEvent = (type) => async (data: SocketData) => {
		// await clientsStore.listClients(true)
		fetchProfile()
	}

	$llanaSubscribe(table, onSocketEvent('CREATE'), onSocketEvent('UPDATE'), onSocketEvent('DELETE'))
}

const refetchUsers = async () => {
	await clientsStore.listClients(true)
}

const updateFirstName = async () => {
	if (!profile.value) return

	const currentFirstName = profile.value.firstName
	const match = currentFirstName.match(/(\d+)$/)
	let newFirstName: string

	if (match) {
		const number = parseInt(match[1], 10)
		newFirstName = currentFirstName.replace(/(\d+)$/, String(number + 1))
	} else {
		newFirstName = `${currentFirstName}1`
	}

	try {
		const response = await $llana({
			type: 'UPDATE',
			table,
			data: { firstName: newFirstName },
			id: profile.value.id,
		})
		if (response.firstName === newFirstName) {
			profile.value.firstName = newFirstName
		} else {
			console.error('Failed to update first name')
		}
	} catch (error) {
		console.error('Failed to update first name', error)
	}
}

onMounted(async () => {
	checkAuth()
	if (isAuthed.value) {
		await fetchProfile()
		// subscribeToUpdates()
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
			<button @click="fetchProfile">Fetch Profile</button>

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
				<p>First Name: {{ profile.firstName }}</p>
				<button @click="updateFirstName">Update First Name</button>
			</div>

			<div v-if="isAuthed">
				<button @click="logout">Logout</button>
				<button @click="subscribeToUpdates">Subscribe to Updates</button>
			</div>

			<div>
				<h2>Clients</h2>
				<ul>
					<li v-for="client in clientsStore.data" :key="client.id">{{ client.email }}</li>
				</ul>
				<button @click="refetchUsers">Refetch Users</button>
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