export function itemImages(item) {
  if (item?.image_urls?.length) return item.image_urls
  return item?.image_url ? [item.image_url] : []
}
