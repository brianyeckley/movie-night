// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CatalogListClient from "@/components/CatalogListClient";
import { deleteCategoryAction } from "@/app/actions";
import type { CatalogCategory, Category } from "@/lib/types";

vi.mock("@/app/actions", () => ({
  deleteMovieAction: vi.fn().mockResolvedValue(undefined),
  deleteCategoryAction: vi.fn().mockResolvedValue(undefined),
  updateMovieAction: vi.fn().mockResolvedValue(undefined),
  addMovieBackgroundImageAction: vi.fn().mockResolvedValue(undefined),
  deleteMovieBackgroundImageAction: vi.fn().mockResolvedValue(undefined),
  updateMovieBackgroundImageAction: vi.fn().mockResolvedValue(undefined),
  addMovieToLegacyAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("CatalogListClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  const emptyCategories: CatalogCategory[] = [
    {
      id: "cat-empty",
      name: "Empty Category",
      isThemed: false,
      isActive: true,
      parentId: null,
      deletedAt: null,
      createdAt: new Date(),
      movies: [],
      subcategories: [
        {
          id: "sub-empty",
          name: "Empty Subcategory",
          isThemed: false,
          isActive: true,
          parentId: "cat-empty",
          deletedAt: null,
          createdAt: new Date(),
          movies: [],
        },
      ],
    },
    {
      id: "cat-action",
      name: "Action",
      isThemed: false,
      isActive: true,
      parentId: null,
      deletedAt: null,
      createdAt: new Date(),
      movies: [
        {
          id: "movie-1",
          title: "Die Hard",
          year: 1988,
          imdbUrl: null,
          trailerUrl: null,
          director: null,
          stars: null,
          runtime: null,
          plot: null,
          posterUrl: null,
          imdbRating: null,
          watched: false,
          physical4K: false,
          physicalBluRay: false,
          physicalDvd: false,
          categoryId: "cat-action",
          deletedAt: null,
          createdAt: new Date(),
          genres: [],
          backgroundImages: [],
        },
      ],
      subcategories: [],
    },
  ];

  const flatCategories: Category[] = [
    {
      id: "cat-empty",
      name: "Empty Category",
      isThemed: false,
      isActive: true,
      parentId: null,
      deletedAt: null,
      createdAt: new Date(),
    },
    {
      id: "sub-empty",
      name: "Empty Subcategory",
      isThemed: false,
      isActive: true,
      parentId: "cat-empty",
      deletedAt: null,
      createdAt: new Date(),
    },
    {
      id: "cat-action",
      name: "Action",
      isThemed: false,
      isActive: true,
      parentId: null,
      deletedAt: null,
      createdAt: new Date(),
    },
  ];

  it("renders empty top-level category and subcategory when no filters are active", () => {
    render(
      <CatalogListClient
        categories={emptyCategories}
        flatCategories={flatCategories}
        genres={[]}
        isAdmin={true}
      />
    );

    // Empty Category and Subcategory should be present in the document
    expect(screen.getByText("Empty Category")).toBeDefined();
    expect(screen.getByText("Empty Subcategory")).toBeDefined();
    expect(screen.getAllByText("0 movies")).toHaveLength(2);
    expect(screen.getByText("No movies in this subcategory yet.")).toBeDefined();
    expect(screen.getByText("Die Hard")).toBeDefined();
  });

  it("allows admin to delete an empty category", async () => {
    render(
      <CatalogListClient
        categories={emptyCategories}
        flatCategories={flatCategories}
        genres={[]}
        isAdmin={true}
      />
    );

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    // Click the first delete button (which is on Empty Category)
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(deleteCategoryAction).toHaveBeenCalledWith("cat-empty");
    });
  });

  it("allows admin to delete an empty subcategory", async () => {
    render(
      <CatalogListClient
        categories={emptyCategories}
        flatCategories={flatCategories}
        genres={[]}
        isAdmin={true}
      />
    );

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    // Second delete button is for Empty Subcategory
    fireEvent.click(deleteButtons[1]);

    await waitFor(() => {
      expect(deleteCategoryAction).toHaveBeenCalledWith("sub-empty");
    });
  });

  it("filters out empty categories that do not match when searching for another movie", async () => {
    render(
      <CatalogListClient
        categories={emptyCategories}
        flatCategories={flatCategories}
        genres={[]}
        isAdmin={true}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search by title, plot, director, or cast...");
    await userEvent.type(searchInput, "Die Hard");

    expect(screen.getByText("Die Hard")).toBeDefined();
    expect(screen.queryByText("Empty Category")).toBeNull();
  });

  it("keeps empty category visible if its name matches the search term", async () => {
    render(
      <CatalogListClient
        categories={emptyCategories}
        flatCategories={flatCategories}
        genres={[]}
        isAdmin={true}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search by title, plot, director, or cast...");
    await userEvent.type(searchInput, "Empty");

    expect(screen.getByText("Empty Category")).toBeDefined();
    expect(screen.queryByText("Die Hard")).toBeNull();
  });
});
