import { create } from "zustand";

// Outfit builder state. Lives in Zustand (not Context) so click-to-add from
// the closet grid and the live preview re-render independently without
// re-rendering the whole tree. Persistence-to-server happens on Save.
interface BuilderItem {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
}

interface BuilderState {
  name: string;
  itemIds: string[];
  itemsById: Record<string, BuilderItem>;
  setName: (n: string) => void;
  add: (item: BuilderItem) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useBuilder = create<BuilderState>((set) => ({
  name: "",
  itemIds: [],
  itemsById: {},
  setName: (name) => set({ name }),
  add: (item) =>
    set((s) =>
      s.itemIds.includes(item.id)
        ? s
        : {
            itemIds: [...s.itemIds, item.id],
            itemsById: { ...s.itemsById, [item.id]: item },
          },
    ),
  remove: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.itemsById;
      return { itemIds: s.itemIds.filter((x) => x !== id), itemsById: rest };
    }),
  clear: () => set({ name: "", itemIds: [], itemsById: {} }),
}));
