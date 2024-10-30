import { defineNuxtModule, addPlugin, createResolver, addImportsDir, addTypeTemplate } from '@nuxt/kit'

export * from './runtime/types'

export default defineNuxtModule({
	meta: {
		name: 'juicyllama/nuxt',
		configKey: 'juicyllama',
	},
	defaults: {},
	setup(_options, _nuxt) {
		const { resolve } = createResolver(import.meta.url)

		addImportsDir(resolve('./runtime/composables'), { prepend: true })
		addPlugin(resolve('./runtime/plugin'))
	},
})
