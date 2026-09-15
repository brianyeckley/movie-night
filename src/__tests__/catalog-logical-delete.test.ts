import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  deleteMovieAction,
  deleteCategoryAction,
  addCategoryAction,
  addSubcategoryAction,
} from "@/app/actions/catalog";

vi.mock("@/lib/db", () => ({
  db: {
    movie: {
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    category: {
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((fns) => Promise.all(fns)),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-id", role: "ADMIN" }),
  requireUser: vi.fn().mockResolvedValue({ id: "user-id", role: "USER" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Catalog Logical Deletes and Revival", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteMovieAction", () => {
    it("performs a logical delete by setting deletedAt rather than deleting the row", async () => {
      vi.mocked(db.movie.update).mockResolvedValueOnce({ id: "movie-1", deletedAt: new Date() } as any);

      await deleteMovieAction("movie-1");

      expect(db.movie.delete).not.toHaveBeenCalled();
      expect(db.movie.update).toHaveBeenCalledWith({
        where: { id: "movie-1" },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe("deleteCategoryAction", () => {
    it("performs a cascading logical delete on category, child subcategories, and contained movies", async () => {
      vi.mocked(db.category.findMany).mockResolvedValueOnce([
        { id: "sub-1" },
        { id: "sub-2" },
      ] as any);

      await deleteCategoryAction("cat-parent");

      expect(db.category.delete).not.toHaveBeenCalled();
      expect(db.movie.delete).not.toHaveBeenCalled();

      // Transaction ran updateMany on movies, updateMany on subcategories, update on category
      expect(db.$transaction).toHaveBeenCalled();
      expect(db.movie.updateMany).toHaveBeenCalledWith({
        where: {
          categoryId: { in: ["cat-parent", "sub-1", "sub-2"] },
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) },
      });
      expect(db.category.updateMany).toHaveBeenCalledWith({
        where: {
          parentId: "cat-parent",
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) },
      });
      expect(db.category.update).toHaveBeenCalledWith({
        where: { id: "cat-parent" },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe("addCategoryAction", () => {
    it("upserts and revives a soft-deleted category by setting deletedAt to null", async () => {
      vi.mocked(db.category.upsert).mockResolvedValueOnce({
        id: "cat-action",
        name: "Action",
        deletedAt: null,
      } as any);

      await addCategoryAction("Action");

      expect(db.category.upsert).toHaveBeenCalledWith({
        where: { name: "Action" },
        update: { deletedAt: null, parentId: null },
        create: { name: "Action" },
      });
    });
  });

  describe("addSubcategoryAction", () => {
    it("revives an existing soft-deleted subcategory with new parentId and deletedAt: null", async () => {
      vi.mocked(db.category.findUnique).mockResolvedValueOnce({
        id: "sub-old",
        name: "JCVD",
        parentId: "old-parent",
        deletedAt: new Date(),
      } as any);
      vi.mocked(db.category.update).mockResolvedValueOnce({
        id: "sub-old",
        name: "JCVD",
        parentId: "new-parent",
        deletedAt: null,
      } as any);

      await addSubcategoryAction("JCVD", "new-parent");

      expect(db.category.update).toHaveBeenCalledWith({
        where: { id: "sub-old" },
        data: {
          parentId: "new-parent",
          deletedAt: null,
        },
      });
      expect(db.category.create).not.toHaveBeenCalled();
    });

    it("creates a fresh subcategory if not already existing", async () => {
      vi.mocked(db.category.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.category.create).mockResolvedValueOnce({
        id: "sub-new",
        name: "Arnold",
        parentId: "cat-action",
      } as any);

      await addSubcategoryAction("Arnold", "cat-action");

      expect(db.category.create).toHaveBeenCalledWith({
        data: {
          name: "Arnold",
          parentId: "cat-action",
        },
      });
    });

    it("throws if an active subcategory with that name already exists", async () => {
      vi.mocked(db.category.findUnique).mockResolvedValueOnce({
        id: "sub-active",
        name: "Arnold",
        deletedAt: null,
      } as any);

      await expect(addSubcategoryAction("Arnold", "cat-action")).rejects.toThrow(
        'A category or subcategory named "Arnold" already exists.'
      );
    });
  });
});
