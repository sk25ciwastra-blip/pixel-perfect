export function meta(judul: string, deskripsi: string) {
  const t = `${judul} — Baturaden 25 Homestay`;
  return {
    meta: [
      { title: t },
      { name: "description", content: deskripsi },
      { property: "og:title", content: t },
      { property: "og:description", content: deskripsi },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
