export default defineNuxtConfig({
	modules: ['../src/module', '@pinia/nuxt'],

	build: {
		transpile: ['#app'],
	},

	devtools: { enabled: true },

	juicyllama: {
		url: 'any',
		debug: true,
		token_key: 'sdsadsa',
	},

	experimental: {
		asyncContext: true,
	},

	runtimeConfig: {
		public: {
			LLANA_INSTANCE_URL: 'http://localhost:3000',
			LLANA_DEBUG: false,
		},
		LLANA_TOKEN_KEY: 'key',
	},

	compatibilityDate: '2025-03-23',
})
