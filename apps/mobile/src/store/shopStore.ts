import { create } from 'zustand';

/** A DISCOUNT promo code the customer entered: applied to the next purchase in the app. */
type Shop = {
  promo: { code: string; percent: number } | null;
  setPromo(promo: Shop['promo']): void;
};

export const useShopStore = create<Shop>((set) => ({
  promo: null,
  setPromo: (promo) => set({ promo }),
}));
