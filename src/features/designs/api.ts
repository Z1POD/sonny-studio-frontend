/**
 * src/features/designs/api.ts
 *
 * User's saved designs — thin wrapper over the store products API.
 * A "design" is a product the user created (draft or published).
 */

export {
  storeProductApi as userDesignsApi,
  getRetailPrice,
} from "@/features/store/api";

export type {
  ProductListItem as DesignListItem,
  ProductDetail as DesignDetail,
  ProductListResponse as DesignListResponse,
  ProductMockup as DesignMockup,
  ProductVariant as DesignVariant,
  ProductPricing as DesignPricing,
} from "@/features/store/api";