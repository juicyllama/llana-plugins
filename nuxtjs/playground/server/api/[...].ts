export default defineEventHandler(async event => {
	const config = useRuntimeConfig()
	const targetBase = config.public.LLANA_INSTANCE_URL

	const { pathname, search } = getRequestURL(event)
	const apiPath = pathname.replace(/^\/api/, '')

	const target = `${targetBase}${apiPath}${search}`

	console.log(`Proxying request to: ${target}`)

	// Forward method, headers, and body automatically:
	return proxyRequest(event, target, {
		// Forward all headers including auth cookies from the original request
		headers: getRequestHeaders(event),
	})
})
