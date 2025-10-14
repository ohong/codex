export type PizzaSize = "slice" | "small" | "medium" | "large" | "tavern";

export interface PizzaItem {
  id: string;
  name: string;
  description: string;
  price: number;
  size?: PizzaSize;
  tags?: string[];
}

export interface MenuCategory {
  id: string;
  title: string;
  items: PizzaItem[];
}

export const pizzaMenu: MenuCategory[] = [
  {
    id: "pies",
    title: "Outta Sight Pies",
    items: [
      {
        id: "tavern",
        name: "Tavern Pie",
        description:
          "Classic thin tavern-style pie with tomato sauce, mozzarella, provolone, parmesan, and oregano.",
        price: 28,
        size: "tavern",
        tags: ["thin crust", "classic"],
      },
      {
        id: "tomato",
        name: "Tomato Pie",
        description:
          "Crispy square pie layered with tomato sauce, aged provolone, pecorino romano, and extra virgin olive oil.",
        price: 26,
        size: "large",
        tags: ["vegetarian"],
      },
      {
        id: "brooklyn",
        name: "Brooklyn Bridge",
        description:
          "Large round pie topped with pepperoni cups, fresh mozzarella, pickled chiles, hot honey, and basil.",
        price: 32,
        size: "large",
        tags: ["spicy", "pepperoni"],
      },
      {
        id: "veg",
        name: "Green Room",
        description:
          "Vegetable-forward pie with roasted mushrooms, charred scallions, spinach, and whipped ricotta.",
        price: 30,
        size: "large",
        tags: ["vegetarian"],
      },
    ],
  },
  {
    id: "slices",
    title: "By The Slice",
    items: [
      {
        id: "tavern-slice",
        name: "Tavern Slice",
        description: "A single slice of the tavern pie.",
        price: 5,
        size: "slice",
      },
      {
        id: "grandma-slice",
        name: "Grandma Slice",
        description: "Thick square slice with rich tomato sauce and mozzarella.",
        price: 6,
        size: "slice",
      },
    ],
  },
  {
    id: "extras",
    title: "Salads & Extras",
    items: [
      {
        id: "caesar",
        name: "Caesar Salad",
        description: "Romaine, parmesan, garlic croutons, anchovy dressing.",
        price: 14,
      },
      {
        id: "meatballs",
        name: "House Meatballs",
        description: "Braised beef and pork meatballs with marinara and ricotta.",
        price: 16,
      },
    ],
  },
];

export const toppingsLexicon: Record<string, string> = {
  pepperoni: "pepperoni",
  sausage: "sausage",
  mushrooms: "mushrooms",
  onions: "onions",
  peppers: "peppers",
  olives: "olives",
  basil: "basil",
  honey: "hot honey",
};

export function formatMenuForPrompt() {
  return pizzaMenu
    .map((category) => {
      const items = category.items
        .map((item) => {
          const tags = item.tags?.length ? ` | Tags: ${item.tags.join(", ")}` : "";
          const size = item.size ? ` | Size: ${item.size}` : "";
          return `- ${item.name} (id: ${item.id})${size} - $${item.price}: ${item.description}${tags}`;
        })
        .join("\n");
      return `${category.title}:\n${items}`;
    })
    .join("\n\n");
}
