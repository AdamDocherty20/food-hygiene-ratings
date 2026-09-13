import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

// Generates a unique slug for a new post from its title, appending "-2", "-3", etc. on
// collision — reuses the same slugify() as establishment URLs rather than a bespoke
// version, so the two stay consistent (accents/punctuation stripped the same way).
export async function generateUniquePostSlug(title: string): Promise<string> {
  const base = slugify(title) || "post";
  let slug = base;
  let suffix = 2;

  while (await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}
