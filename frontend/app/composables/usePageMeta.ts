// Title, description, social card and canonical address of one page, from a single source.
export function usePageMeta(path: string, title: string, description: string): void {
  const url = `${SITE_URL}${path}`
  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogUrl: url,
    twitterTitle: title,
    twitterDescription: description,
  })
  useHead({ link: [{ rel: 'canonical', href: url }] })
}
