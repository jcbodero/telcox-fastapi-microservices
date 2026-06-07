const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || ''
const MIXPANEL_API_HOST = process.env.NEXT_PUBLIC_MIXPANEL_API_HOST || 'https://api-eu.mixpanel.com'

let mixpanelInstance = null
let mixpanelPromise = null

export const initMixpanel = async () => {
  if (typeof window === 'undefined' || !MIXPANEL_TOKEN) return null
  if (mixpanelInstance) return mixpanelInstance
  if (!mixpanelPromise) {
    mixpanelPromise = import('mixpanel-browser').then((module) => {
      const mixpanel = module.default || module
      mixpanel.init(MIXPANEL_TOKEN, {
        api_host: MIXPANEL_API_HOST,
        batch_requests: false,
        debug: process.env.NODE_ENV !== 'production',
        ignore_dnt: true,
        persistence: 'localStorage',
        track_pageview: false,
      })
      if (process.env.NODE_ENV !== 'production') {
        window.telcoxMixpanel = mixpanel
      }
      mixpanelInstance = mixpanel
      return mixpanel
    })
  }
  return mixpanelPromise
}

export const trackEvent = async (eventName, properties = {}) => {
  const mixpanel = await initMixpanel()
  if (!mixpanel) return
  mixpanel.track(eventName, {
    app: 'telcox-ui',
    source: 'web',
    ...properties,
  })
}

export const trackPageView = (path) => {
  const properties = {
    path,
    current_url: typeof window !== 'undefined' ? window.location.href : path,
    title: typeof document !== 'undefined' ? document.title : 'TelcoX',
  }
  trackEvent('Page Viewed', properties)
  trackEvent('$mp_web_page_view', properties)
}

export const identifyUser = async (user) => {
  if (!user) return
  const mixpanel = await initMixpanel()
  if (!mixpanel) return

  const distinctId = user.id || user.sub || user.email || user.username
  if (!distinctId) return

  mixpanel.identify(distinctId)
  mixpanel.people.set({
    $email: user.email,
    $name: user.full_name || user.name || user.username,
    username: user.username,
  })
}
