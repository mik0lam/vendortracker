import setsJson from "@/data/pokemon-sets.json";

export type PokemonSet = {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
};

export const POKEMON_SETS = setsJson as PokemonSet[];
