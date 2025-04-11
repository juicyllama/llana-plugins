export default defineNuxtConfig({
	modules: ['../src/module', '@pinia/nuxt'],
	ssr: true,

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
			LLANA_INSTANCE_PROXY_URL: 'http://localhost:3001/api',
			LLANA_DEBUG: true,
		},
		LLANA_TOKEN_KEY: 'key',
	},

	compatibilityDate: '2025-04-03',
})
