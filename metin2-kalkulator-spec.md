# Metin2 Kalkulator Materiałów — specyfikacja projektu

## 1. Cel projektu

Aplikacja webowa do przeglądania itemków z gry Metin2, pogrupowanych w rozdziały, gdzie każdy item ma przypisaną listę materiałów potrzebnych do jego wykonania. Zwykli użytkownicy wpisują ręcznie aktualne ceny materiałów i widzą automatycznie wyliczony łączny koszt itemka. Tylko admin (właściciel) może dodawać/edytować rozdziały, itemki i materiały.

## 2. Stack technologiczny

- **Frontend:** React (Vite)
- **Backend / baza / auth / storage obrazków:** Supabase (Postgres + Auth + Storage + Row Level Security)
- **Hosting frontendu:** Vercel lub Netlify (darmowy plan wystarczy)
- **Stylowanie:** Tailwind CSS

## 3. Role użytkowników

- **Admin (Ty):** jedno konto w Supabase Auth (email+hasło). Po zalogowaniu widzi dodatkowe przyciski `+`, edycji i formularze. Wszystkie operacje zapisu (INSERT/UPDATE) idą przez Supabase i są chronione przez Row Level Security — wymagają zalogowanej roli admina.
- **Gość (reszta userów):** brak logowania. Widzi wyłącznie odczyt danych (SELECT, publiczny). Wpisywane przez niego ceny materiałów **nie są zapisywane w bazie** — trzymane tylko lokalnie w stanie przeglądarki (React state + localStorage, żeby przetrwało odświeżenie strony).

## 4. Schemat bazy danych (Postgres / Supabase)

```sql
-- Rozdziały (kategorie itemków)
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  created_at timestamptz default now()
);

-- Materiały (globalna baza, bez ceny — cena jest lokalna u usera)
create table materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  created_at timestamptz default now()
);

-- Itemki
create table items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade not null,
  name text not null,
  image_url text,
  created_at timestamptz default now()
);

-- Receptura: które materiały i w jakiej ilości wchodzą w dany item
create table item_materials (
  item_id uuid references items(id) on delete cascade not null,
  material_id uuid references materials(id) on delete cascade not null,
  quantity numeric not null default 1,
  primary key (item_id, material_id)
);
```

## 5. Row Level Security (RLS) — reguły

Włącz RLS na wszystkich czterech tabelach. Dla każdej:

```sql
alter table categories enable row level security;
alter table materials enable row level security;
alter table items enable row level security;
alter table item_materials enable row level security;

-- Odczyt: publiczny dla wszystkich (także niezalogowanych)
create policy "public read" on categories for select using (true);
create policy "public read" on materials for select using (true);
create policy "public read" on items for select using (true);
create policy "public read" on item_materials for select using (true);

-- Zapis: tylko zalogowany admin (sprawdzane po konkretnym user_id z Supabase Auth)
create policy "admin write" on categories for all
  using (auth.uid() = 'TWOJE_ADMIN_UUID')
  with check (auth.uid() = 'TWOJE_ADMIN_UUID');
-- analogicznie dla materials, items, item_materials
```

Claude Code powinien podmienić `'TWOJE_ADMIN_UUID'` na realne UUID Twojego konta po jego utworzeniu w Supabase Auth.

## 6. Storage obrazków

Utwórz w Supabase Storage bucket `images` (publiczny odczyt, zapis tylko dla admina — analogiczna reguła jak wyżej). Upload obrazków przy dodawaniu materiału/itemka/kategorii, zapisujesz tylko URL w kolumnie `image_url`.

## 7. Struktura stron (routing)

```
/                          → strona główna: kafelki [Materiały] [Rozdział I] [Rozdział II] ... [+ jeśli admin]
/materialy                 → lista materiałów (nazwa + zdjęcie), [+ jeśli admin] dodaje nowy materiał
/rozdzial/:categoryId       → grid itemków z danego rozdziału, [+ jeśli admin] dodaje nowy item
/rozdzial/:categoryId/item/:itemId → widok itemka: nazwa, zdjęcie, lista materiałów z polami do wpisania ceny + wyliczony koszt total
/login                      → logowanie admina (Supabase Auth)
```

## 8. Kluczowe komponenty i logika

- **AuthContext** — provider trzymający sesję Supabase, udostępnia `isAdmin` (bool) do warunkowego renderowania przycisków `+`/edycji w całej appce.
- **CategoryGrid** — fetch `categories`, renderuje kafelki, link do `/rozdzial/:id`.
- **MaterialsList** — fetch `materials`, lista z miniaturkami.
- **ItemGrid** (widok rozdziału) — fetch `items` gdzie `category_id = :categoryId`.
- **ItemDetail** (widok itemka) — kluczowy ekran kalkulatora:
  1. fetch item + jego `item_materials` (join z `materials` po nazwę/zdjęcie)
  2. dla każdego materiału render `<input type="number">` do wpisania ceny — stan lokalny (`useState`, obiekt `{materialId: cena}`)
  3. na każdą zmianę inputu przelicz `total = sum(quantity_i * cena_i)` i wyświetl
  4. **opcjonalnie:** zapisz wpisane ceny do `localStorage` pod kluczem powiązanym z `itemId`, żeby po odświeżeniu strony user nie musiał wpisywać od nowa
- **AdminForms** — formularze dodawania kategorii/materiału/itemka (nazwa + upload zdjęcia + w przypadku itemka: multi-select materiałów z polem ilości przy każdym wybranym). Widoczne i dostępne tylko gdy `isAdmin === true`.

## 9. Kolejność implementacji (kroki dla Claude Code)

1. Setup projektu: `npm create vite@latest` (React), zainstaluj Tailwind, Supabase JS client (`@supabase/supabase-js`).
2. Utwórz projekt w Supabase (ręcznie przez dashboard albo Supabase CLI), odpal powyższe SQL (tabele + RLS).
3. Skonfiguruj Supabase Auth — utwórz jedno konto admina, zapisz jego UUID, podmień w RLS.
4. Zbuduj `AuthContext` + ekran `/login`.
5. Zbuduj widoki odczytowe (CategoryGrid, MaterialsList, ItemGrid, ItemDetail) — na sztywno z pustą bazą, sprawdź czy fetch działa.
6. Dodaj kalkulator w ItemDetail (inputy + wyliczanie total).
7. Dodaj formularze admina (dodawanie kategorii/materiału/itemka + upload zdjęć do Supabase Storage) — widoczne tylko po zalogowaniu.
8. Podepnij localStorage do zapamiętywania wpisanych cen per item.
9. Stylowanie (Tailwind) — grid kafelków, karty itemków, responsywność.
10. Deploy: frontend na Vercel, zmienne środowiskowe (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) w configu hostingu.

## 10. Rzeczy do decyzji później (nie blokują startu)

- Czy dodać podkategorie w rozdziale (np. bronie/zbroje osobno).
- Czy dodać wyszukiwarkę/filtr itemków w dużym rozdziale.
- Czy materiał może mieć własną "domyślną" cenę sugerowaną (np. ostatnio wpisana przez kogoś, tylko jako podpowiedź — nadal bez zapisu do bazy jako prawda).
