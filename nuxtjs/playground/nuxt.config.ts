export default defineNuxtConfig({
	modules: ['../src/module'],
	devtools: { enabled: true },
	juicyllama: {
		url: 'any',
		debug: false,
		token_key: 'sdsadsa',
	},
	runtimeConfig: {
		public: {
			LLANA_INSTANCE_URL: 'test',
			LLANA_DEBUG: false,
		},
		LLANA_TOKEN_KEY: 'key',
	},
})
