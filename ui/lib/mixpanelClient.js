const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || ''

let mixpanelInstance = null
let mixpanelPromise = null

export const initMixpanel = async () => {
  if (typeof window === 'undefined' || !MIXPANEL_TOKEN) return null
  if (mixpanelInstance) return mixpanelInstance
  if (!mixpanelPromise) {
    mixpanelPromise = import('mixpanel-browser').then((module) => {
      const mixpanel = module.default || module
      mixpanel.init(MIXPANEL_TOKEN, {
        debug: process.env.NODE_ENV !== 'production',
        persistence: 'localStorage',
        track_pageview: false,
      })
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
    ...properties,
  })
}

export const trackPageView = (path) => {
  trackEvent('Page Viewed', {
    path,
    title: typeof document !== 'undefined' ? document.title : 'TelcoX',
  })
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
