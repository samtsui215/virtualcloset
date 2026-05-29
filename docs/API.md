# API

All routes return JSON. Authenticated routes require a NextAuth session cookie. The user id is derived from the session — never sent in the body.

## Auth

### `POST /api/register`
Create a new user.
```json
{ "email": "you@example.com", "password": "minimum-8-chars", "name": "Sam" }
```
**201** `{ "id": "...", "email": "...", "name": "..." }`
**409** if email already exists.

### `POST /api/auth/callback/credentials`
Handled by NextAuth. Use `signIn("credentials", { email, password })` from the client.

### `POST /api/auth/signout`
Handled by NextAuth.

## Items

### `GET /api/items`
List the caller's items. Query params (all optional):
- `category` — `TOP | BOTTOM | SHOES | OUTERWEAR | ACCESSORY`
- `season` — `SUMMER | FALL | WINTER | SPRING | ALL`
- `style` — `CASUAL | FORMAL | ATHLETIC | BUSINESS | STREETWEAR`
- `tag` — repeatable; items must include every tag listed
- `q` — full-text search (name, notes, tags via ILIKE)
- `limit` — default 60, max 200
- `cursor` — item id; pages forward

Returns `{ "items": ClothingItem[], "nextCursor": string | null }`.

### `POST /api/upload`
Multipart form-data, field `file`. Returns the processed image's URL and detected metadata, but does *not* create an item record.
```json
{
  "url": "/uploads/abc123.webp",
  "key": "abc123.webp",
  "width": 960, "height": 1280,
  "blurDataUrl": "data:image/webp;base64,…",
  "primaryColor": "#1a2233",
  "colorFamily": "denim"
}
```

### `POST /api/items`
Create an item using the URL and metadata returned by `/api/upload`.
```json
{
  "name": "Linen oxford",
  "category": "TOP",
  "primaryColor": "#f0eee5",
  "colorFamily": "neutral",
  "seasons": ["SUMMER", "SPRING"],
  "styles": ["CASUAL", "BUSINESS"],
  "tags": ["shirt", "linen"],
  "notes": "Light, breathable",
  "imageUrl": "/uploads/abc123.webp",
  "imageBlurDataUrl": "data:…",
  "imageWidth": 960,
  "imageHeight": 1280
}
```
**201** returns the created `ClothingItem`.

### `GET /api/items/:id`
Single item, 404 if not yours.

### `PATCH /api/items/:id`
Partial update. Any subset of `name, primaryColor, colorFamily, seasons, styles, tags, notes`.

### `DELETE /api/items/:id`
Delete. Cascades to remove the item from outfits.

## Outfits

### `GET /api/outfits`
List outfits. Optional query params: `season`, `occasion`, `tag`, `favorite=true`, `q`. Includes joined items.

### `POST /api/outfits`
Create an outfit. Requires ≥2 items, all owned by the caller.
```json
{
  "name": "Friday casual",
  "itemIds": ["ck...", "ck...", "ck..."],
  "tags": ["work"],
  "occasion": "casual",
  "season": "SUMMER",
  "favorite": false,
  "generated": false
}
```
Side effects: increments `ItemPairing` co-occurrence counts for every pair.

### `GET /api/outfits/:id`
Single outfit with items, 404 if not yours.

### `PATCH /api/outfits/:id`
Partial update. If `itemIds` is included, the join rows are replaced atomically.

### `DELETE /api/outfits/:id`
Delete. Cascades wears, feedback, item joins.

### `POST /api/outfits/generate`
Generate ranked outfit suggestions.
```json
{
  "season": "summer",
  "occasion": "casual",
  "weather": { "tempF": 78, "rain": false },
  "limit": 5,
  "excludeItemIds": [],
  "includeOuterwear": false
}
```
Returns an array of generated outfits, sorted by score descending:
```json
[
  {
    "outfitId": "gen-1",
    "score": 12.371,
    "breakdown": {
      "total": 12.371,
      "color": 0.93,
      "season": 1,
      "style": 1,
      "history": 0.55,
      "favorite": 0.33,
      "exploration": 0
    },
    "items": [ ClothingItem, ClothingItem, ClothingItem ]
  }
]
```
The `outfitId` is synthetic — call `POST /api/outfits` with the item ids to persist it.

### `POST /api/outfits/feedback`
Record like/dislike on a generated or saved outfit.
```json
{ "outfitId": "ck...", "signal": 1, "itemIds": ["ck...", "ck..."] }
```
- `outfitId` optional — omit when the outfit is still a transient generated one.
- `signal` — `1` (like) or `-1` (dislike). A `like` also increments `ItemPairing` so the model learns from it. A `dislike` records feedback but does *not* decrement.
- `itemIds` — required when `outfitId` is absent.

## Error shape

```json
{ "error": "Human-readable message", "details": { /* optional zod issues */ } }
```

Common codes: `400` invalid body, `401` unauthorized, `403` resource not owned, `404` not found, `409` conflict, `413` payload too large, `415` unsupported media type.
