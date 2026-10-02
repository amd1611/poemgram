export type Post = { id: string; img: string; cap: string; t: number };
export type Profile = { id: string; username: string; name: string; bio: string; avatar: string; posts: Post[]; updated: number };
export type Summary = Omit<Profile, 'posts'> & { n: number };
