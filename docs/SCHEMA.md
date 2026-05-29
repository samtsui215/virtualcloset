# Database schema

Single source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma). This document is the prose explanation.

## ER diagram

```
       ┌───────────┐
       │   User    │ 1
       └─────┬─────┘
             │ owns
   ┌─────────┼──────────┬─────────────┬──────────────┬──────────────┐
   │         │          │             │              │              │
   ▼         ▼          ▼             ▼              ▼              ▼
ClothingItem Outfit  OutfitWear  ItemPairing  OutfitFeedback   (cascade
   │           │                                                deletes
   │           │                                                from User)
   │           │
   │ M ▲ N     │
   └──→OutfitItem (join table)
```

## Enums

- `Category` — `TOP, BOTTOM, SHOES, OUTERWEAR, ACCESSORY`
- `Season` — `SUMMER, FALL, WINTER, SPRING, ALL`
- `Style` — `CASUAL, FORMAL, ATHLETIC, BUSINESS, STREETWEAR`

## Tables

### `User`
| field | type | notes |
|-------|------|-------|
| id | cuid | PK |
| email | string | unique |
| passwordHash | string | bcrypt, 12 rounds |
| name | string? | display name |
| createdAt | timestamp | |

### `ClothingItem`
| field | type | notes |
|-------|------|-------|
| id | cuid | PK |
| userId | cuid | FK → User, **cascade** |
| name | string | |
| category | Category | |
| primaryColor | string | hex e.g. `#1a2233` (extracted at upload) |
| colorFamily | string | coarse semantic bucket used by scoring |
| seasons | Season[] | Postgres array |
| styles | Style[] | |
| tags | string[] | user-defined |
| notes | string? | |
| imageUrl | string | absolute or `/uploads/...` |
| imageBlurDataUrl | string? | LQIP base64 |
| imageWidth, imageHeight | int? | for `next/image` |
| createdAt, updatedAt | timestamp | |

Indexes: `(userId, category)`, `(userId, createdAt)` for the two access patterns the closet UI exercises.

### `Outfit`
| field | type | notes |
|-------|------|-------|
| id | cuid | PK |
| userId | cuid | FK → User, cascade |
| name | string | |
| tags | string[] | |
| occasion | string? | free-form |
| season | Season? | |
| favorite | bool | scoring uses this to boost member items |
| generated | bool | true when saved from a system suggestion |
| createdAt, updatedAt | timestamp | |

Index: `(userId, createdAt)`.

### `OutfitItem` (join)
Composite PK `(outfitId, itemId)`. Extra index on `itemId` for "which outfits include this item?" reverse lookups.

### `OutfitWear`
Append-only log of "I wore this outfit today." Lets us reason about recency later (e.g. "items not worn in 60 days"). Each row triggers the same `recordPairings` side effect a Save does.

### `ItemPairing`
Learned co-occurrence weights. Composite PK `(userId, itemAId, itemBId)`, with the pair stored in canonical order (`itemAId < itemBId`) so the table is half the size and lookups are deterministic. Updated via `prisma.itemPairing.upsert` so the first co-occurrence creates the row and every subsequent one increments `count`.

### `OutfitFeedback`
`signal` is `+1` (like) or `-1` (dislike). Becomes training data once we ship an embedding-based reranker.

## Cascades

Deleting a user removes all of their items, outfits, wears, pairings, and feedback. Deleting an item removes its row from every outfit it was in (the outfit itself survives — it just gets shorter). This is intentional: a user who deletes a sweater shouldn't lose every "fall casual" outfit it was in.

## Why arrays instead of join tables for seasons/styles/tags

These are small bounded sets and the query patterns are all "does the array contain X?". Postgres array columns + a GIN index hit that pattern faster than a join, and Prisma exposes `has`/`hasSome`/`hasEvery` operators directly. If we later need per-tag metadata (color, owner, etc.), promoting tags to a separate table is a one-migration change.
