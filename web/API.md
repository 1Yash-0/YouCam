# YouCam Web API Documentation

## Overview

This document describes all API routes available in the YouCam web application. All routes are prefixed with `/api`.

## Authentication

### Admin Authentication
- **Header**: `x-admin-token` must match the `ADMIN_TOKEN` environment variable
- **If ADMIN_TOKEN is unset**: All admin routes return 503 with code `ADMIN_DISABLED`
- **If token missing or invalid**: Returns 401 with code `UNAUTHORIZED`

## Product Management

### GET /api/products
**Returns**: List of all products (seed + runtime)

**Response**:
```json
[
  {
    "id": "gilded-teardrop",
    "name": "Gilded Teardrop",
    "brand": "Kaari Studio",
    "type": "single",
    "heightCm": 3.0,
    "widthCm": 1.3,
    "metal": "gold",
    "priceInr": 1499,
    "imagePath": "/products/teardrop-gold.png",
    "source": "Generated with YouCam AI Image Generator V2.0",
    "licence": "Generated for this project",
    "sizes": [2.0, 3.0, 4.5, 6.0]
  }
]
```

**Error Codes**:
- `INTERNAL_ERROR` (500): Failed to fetch products

### GET /api/products/[id]/image
**Returns**: Product image (PNG or JPEG)

**Headers**:
- `Content-Type`: image/png or image/jpeg
- `Cache-Control`: public, max-age=31536000, immutable

**Error Codes**:
- `NOT_FOUND` (404): Product or image not found
- `INTERNAL_ERROR` (500): Failed to serve image

## Admin Product Management

### POST /api/admin/products
**Method**: POST (multipart/form-data)

**Authentication**: Admin token required

**Body**:
- `id`: string (required) - Unique product identifier
- `name`: string (required) - Product name
- `brand`: string (required) - Brand name
- `type`: enum (required) - 'single', 'stud', 'necklace', or 'garment'
- `priceInr`: number (required) - Price in INR (> 0)
- `image`: file (required) - Product image (PNG/JPEG)
- Type-specific fields:
  - For 'single' or 'stud':
    - `heightCm`: number (required) - Height in cm (> 0)
    - `widthCm`: number (required) - Width in cm (> 0)
    - `metal`: string (optional) - Metal type
    - `sizes`: string (optional) - JSON array of available sizes
    - `anchorPoint`: string (optional) - JSON tuple [x, y] for anchor point
  - For 'necklace':
    - `lengthCm`: number (required) - Length in cm (> 0)
  - For 'garment':
    - `garmentCategory`: enum (required) - 'upper_body', 'lower_body', 'full_body', or 'outer'

**Image Processing**:
- Converted to PNG
- Long side resized to ≤ 1500px while maintaining aspect ratio
- Stored in `DATA_DIR/products/<id>.png`

**Response** (201):
```json
{
  "id": "new-product",
  "name": "New Product",
  "type": "single",
  "message": "Product created successfully"
}
```

**Error Codes**:
- `ADMIN_DISABLED` (503): Admin functionality disabled
- `UNAUTHORIZED` (401): Invalid or missing admin token
- `INVALID_INPUT` (400): Validation failed
- `CONFLICT` (409): Product ID already exists
- `INTERNAL_ERROR` (500): Failed to create product

### PATCH /api/admin/products/[id]
**Method**: PATCH

**Authentication**: Admin token required

**Body** (at least one field required):
```json
{
  "anchorPoint": [0.5, 0.5],
  "sizes": [2.0, 3.0, 4.5],
  "priceInr": 1999,
  "heightCm": 3.5
}
```

**Response**:
```json
{
  "id": "product-id",
  "name": "Product Name",
  "type": "single",
  "updatedFields": ["priceInr", "heightCm"],
  "message": "Product updated successfully"
}
```

**Error Codes**:
- `ADMIN_DISABLED` (503): Admin functionality disabled
- `UNAUTHORIZED` (401): Invalid or missing admin token
- `INVALID_INPUT` (400): Validation failed or no fields provided
- `FORBIDDEN` (403): Cannot update seed product
- `NOT_FOUND` (404): Runtime product not found
- `INTERNAL_ERROR` (500): Failed to update product

### DELETE /api/admin/products/[id]
**Method**: DELETE

**Authentication**: Admin token required

**Response**:
```json
{
  "id": "product-id",
  "message": "Product deleted successfully"
}
```

**Side Effects**:
- Invalidates cached YouCam file_id metadata
- Removes from runtime products catalogue
- Image file remains (not deleted)

**Error Codes**:
- `ADMIN_DISABLED` (503): Admin functionality disabled
- `UNAUTHORIZED` (401): Invalid or missing admin token
- `FORBIDDEN` (403): Cannot delete seed product
- `NOT_FOUND` (404): Runtime product not found
- `INTERNAL_ERROR` (500): Failed to delete product

## Looks (Share Links)

### POST /api/looks
**Method**: POST

**Body**:
```json
{
  "flow": "single-earring",
  "productId": "gilded-teardrop",
  "sizeCm": 3.0,
  "stack": ["dot-stud"],
  "options": {
    "background": "studio"
  }
}
```

**Validation**:
- Product must exist in catalogue
- Size must be valid for product (if provided)
- Stored in `DATA_DIR/looks/<lookId>.json`

**Response** (201):
```json
{
  "lookId": "a1b2c3d4e5f67890"
}
```

**Error Codes**:
- `INVALID_INPUT` (400): Validation failed
- `INTERNAL_ERROR` (500): Failed to create look

### GET /api/looks/[lookId]
**Returns**: Look configuration

**Response**:
```json
{
  "id": "a1b2c3d4e5f67890",
  "createdAt": "2024-01-01T00:00:00Z",
  "flow": "single-earring",
  "productId": "gilded-teardrop",
  "sizeCm": 3.0,
  "stack": ["dot-stud"],
  "options": {
    "background": "studio"
  }
}
```

**Error Codes**:
- `NOT_FOUND` (404): Look not found
- `INTERNAL_ERROR` (500): Failed to fetch look

## Sample Gallery

### GET /api/sample
**Returns**: List of sample looks

**Response**:
```json
[
  {
    "id": "single-teardrop-3cm",
    "title": "Single Teardrop (3 cm)",
    "flow": "single-earring",
    "productId": "gilded-teardrop",
    "sizeCm": 3.0,
    "steps": ["upload", "detect", "tryon"],
    "imageUrl": "/api/sample/single-teardrop-3cm/image"
  }
]
```

**Empty Response**: `[]` when no manifest exists

### GET /api/sample/[id]/image
**Returns**: Sample image (PNG or JPEG)

**Headers**:
- `Content-Type`: image/png or image/jpeg
- `Cache-Control`: public, max-age=31536000, immutable

**Error Codes**:
- `NOT_FOUND` (404): Sample or image not found
- `INTERNAL_ERROR` (500): Failed to serve image

## Recommendation APIs

### POST /api/recommend/metal
**Body**:
```json
{
  "skinHex": "#FFD8B1",
  "zari": "gold"
}
```

**Response**:
```json
{
  "metal": "gold",
  "undertone": "warm",
  "reason": "Zari specified as gold",
  "numbers": {
    "L": 85.6,
    "a": 5.2,
    "b": 15.8,
    "hueDeg": 71.8
  },
  "label": "Warm undertone, gold metal"
}
```

### POST /api/recommend/lipstick
**Body**:
```json
{
  "skinHex": "#FFD8B1",
  "outfitHex": "#A1001E"
}
```

**Response**:
```json
{
  "id": "blue-red",
  "name": "Blue Red",
  "hex": "#A1001E",
  "texture": "matte",
  "reason": "Red-family outfit with cool undertone",
  "deltaE": 45.2,
  "label": "Cool blue-based red"
}
```

## Analysis APIs

### POST /api/analyse/skin-tone
**Body**:
```json
{
  "photoId": "photo-123"
}
```

**Response**:
```json
{
  "skinHex": "#FFD8B1",
  "lipHex": "#C06C84",
  "eyeHex": "#4A4A4A",
  "hairHex": "#3C2F2F"
}
```

**Error Codes**:
- `FACE_NOT_FRONTAL` (400): Face not forward-facing
- `INTERNAL_ERROR` (500): Analysis failed

### GET /api/hair/templates
**Returns**: List of free hair templates

**Response**:
```json
[
  {
    "id": "bun-01",
    "title": "Classic Bun",
    "thumb": "https://...",
    "keepsColour": true
  }
]
```

## Health & System APIs

### GET /api/health
**Returns**: System health status

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### GET /api/photo/[hash]
**Returns**: Uploaded photo

### POST /api/photo
**Method**: POST (multipart/form-data)
**Body**: `photo` (file)

### POST /api/tryon
Creates a cached, resumable try-on pipeline. The default flow is `ear`; use `neck` for a necklace preview.

**Body**:
```json
{
  "flow": "ear",
  "photoId": "<uploaded-photo-id>",
  "productId": "gilded-teardrop",
  "sizeCm": 3.0,
  "ear": "right",
  "occluded": 0,
  "wearingLocation": [375, 660],
  "irisPx": 37,
  "stack": [{ "productId": "dot-stud", "sizeCm": 0.6, "wearingLocation": [375, 660] }],
  "options": {
    "hairUp": { "templateId": "<hair-template-id>" },
    "lipstick": { "hex": "#9B1B30", "texture": "matte", "intensity": 70 },
    "outfit": { "productId": "emerald-blouse" }
  }
}
```
`flow` and `options` are optional. Ear steps run in this order: outfit, hair, lipstick, then earring/stack. Neck steps run as outfit, lipstick, necklace; `productId` must be a necklace and neck requests reject `sizeCm`, `ear`, `stack`, and `wearingLocation`.

A fully cached request returns the completed response immediately. Otherwise the response is:
```json
{ "status": "running", "jobId": "<job-id>" }
```

### GET /api/tryon/[jobId]
Each request creates or polls at most one YouCam task. Responses are:
```json
{ "status": "running", "step": "makeup", "stepIndex": 0, "totalSteps": 2 }
```
or:
```json
{
  "status": "done",
  "result": {
    "key": "<sha256>",
    "imageUrl": "/api/result/<sha256>",
    "flow": "ear",
    "steps": [
      { "type": "makeup", "units": 1, "cached": false },
      { "type": "earring", "units": 1, "cached": false }
    ],
    "unitsSpent": 2,
    "measurement": {},
    "identityNote": "Hairstyle preview is AI-generated and may slightly change your appearance."
  }
}
```
`measurement` is returned only for ear flow and is computed from the earring step's input and output. `identityNote` is present when a hair step is used. A failure response is:
```json
{ "status": "error", "code": "NECK_NOT_VISIBLE", "userMessage": "Face the camera straight on with your neck and collarbones visible.", "step": "necklace" }
```

### GET /api/result/[key]
Returns the final PNG. The key is derived from the ordered step cache keys and is independent of the job ID.

## Error Response Format

All error responses follow this format:
```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

Additional fields may be present for validation errors:
```json
{
  "code": "INVALID_INPUT",
  "message": "Validation failed",
  "errors": [
    {
      "path": "priceInr",
      "message": "Price must be positive"
    }
  ]
}
```