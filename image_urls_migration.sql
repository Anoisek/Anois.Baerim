alter table items add column image_urls text[] not null default '{}';
update items set image_urls = array[image_url] where image_url is not null;
