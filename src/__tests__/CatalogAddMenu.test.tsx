// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CatalogAddMenu from "@/components/CatalogAddMenu";
import {
  addCategoryAction,
  addSubcategoryAction,
  addThemeAction,
  addMovieAction,
} from "@/app/actions";

vi.mock("@/app/actions", () => ({
  addCategoryAction: vi.fn().mockResolvedValue({ id: "c-2", name: "Horror" }),
  addSubcategoryAction: vi.fn().mockResolvedValue({ id: "c-3", name: "Van Damme" }),
  addThemeAction: vi.fn().mockResolvedValue({ id: "t-1", name: "Halloween" }),
  addMovieAction: vi.fn().mockResolvedValue({ id: "m-1", title: "Robot Jox" }),
}));

const categories = [
  { id: "c-1", name: "Action", parentId: null },
  { id: "c-9", name: "Martial Arts", parentId: "c-1" },
];
const genres = [{ id: "g-1", name: "Comedy" }];
const themes = [{ id: "t-9", name: "Christmas" }];

function renderMenu() {
  return render(<CatalogAddMenu categories={categories} genres={genres} themes={themes} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.style.overflow = "";
});

describe("the Add menu", () => {
  it("keeps every option behind one button until it is opened", async () => {
    const user = userEvent.setup();
    renderMenu();

    expect(screen.queryByRole("menuitem", { name: /movie/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByRole("menuitem", { name: /movie/i })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: /^category$/i })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: /subcategory/i })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: /theme/i })).toBeDefined();
  });

  it("closes when a click lands outside it", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /add/i }));
    expect(screen.getByRole("menu")).toBeDefined();

    await user.click(document.body);

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});

describe("the forms it opens", () => {
  /** Open the menu and pick one of its items. */
  async function openForm(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
    await user.click(screen.getByRole("button", { name: /add/i }));
    await user.click(screen.getByRole("menuitem", { name }));
  }

  it("opens the movie form in a modal, not in the page", async () => {
    const user = userEvent.setup();
    renderMenu();

    await openForm(user, /movie/i);

    expect(screen.getByText("Add New Movie")).toBeDefined();
    expect(screen.getByLabelText(/IMDb Link/i)).toBeDefined();
    // The modal is portalled to the body and locks the page behind it.
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("creates a category and clears the field for the next one", async () => {
    const user = userEvent.setup();
    renderMenu();

    await openForm(user, /^category$/i);
    const input = screen.getByLabelText(/Category Name/i);
    await user.type(input, "Horror");
    await user.click(screen.getByRole("button", { name: /create category/i }));

    await waitFor(() => expect(addCategoryAction).toHaveBeenCalledWith("Horror"));
    expect(await screen.findByText(/"Horror" added/)).toBeDefined();
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("creates a subcategory under the parent that was picked", async () => {
    const user = userEvent.setup();
    renderMenu();

    await openForm(user, /subcategory/i);
    await user.selectOptions(screen.getByLabelText(/Parent Category/i), "c-1");
    await user.type(screen.getByLabelText(/Subcategory Name/i), "Van Damme");
    await user.click(screen.getByRole("button", { name: /create subcategory/i }));

    await waitFor(() => expect(addSubcategoryAction).toHaveBeenCalledWith("Van Damme", "c-1"));
  });

  it("offers only top-level categories as a parent", async () => {
    const user = userEvent.setup();
    renderMenu();

    await openForm(user, /subcategory/i);

    const options = Array.from(
      screen.getByLabelText(/Parent Category/i).querySelectorAll("option")
    ).map((o) => o.textContent);
    expect(options).toContain("Action");
    expect(options).not.toContain("Martial Arts");
  });

  it("creates a theme", async () => {
    const user = userEvent.setup();
    renderMenu();

    await openForm(user, /theme/i);
    await user.type(screen.getByLabelText(/Theme Name/i), "Halloween");
    await user.click(screen.getByRole("button", { name: /create theme/i }));

    await waitFor(() => expect(addThemeAction).toHaveBeenCalledWith("Halloween"));
  });

  it("trims a name before sending it", async () => {
    const user = userEvent.setup();
    renderMenu();

    await openForm(user, /^category$/i);
    await user.type(screen.getByLabelText(/Category Name/i), "  Horror  ");
    await user.click(screen.getByRole("button", { name: /create category/i }));

    await waitFor(() => expect(addCategoryAction).toHaveBeenCalledWith("Horror"));
  });

  it("shows why a create failed instead of closing", async () => {
    const user = userEvent.setup();
    vi.mocked(addThemeAction).mockRejectedValueOnce(new Error("Theme already exists."));
    renderMenu();

    await openForm(user, /theme/i);
    await user.type(screen.getByLabelText(/Theme Name/i), "Halloween");
    await user.click(screen.getByRole("button", { name: /create theme/i }));

    expect(await screen.findByText("Theme already exists.")).toBeDefined();
    expect(screen.getByLabelText(/Theme Name/i)).toBeDefined();
  });

  it("closes on Escape and gives the page back its scroll", async () => {
    const user = userEvent.setup();
    renderMenu();

    await openForm(user, /theme/i);
    expect(screen.getByLabelText(/Theme Name/i)).toBeDefined();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(document.body.style.overflow).toBe(""));
  });

  it("swaps the form when a different item is picked", async () => {
    const user = userEvent.setup();
    renderMenu();

    await openForm(user, /theme/i);
    expect(screen.getByLabelText(/Theme Name/i)).toBeDefined();

    await user.keyboard("{Escape}");
    await openForm(user, /^category$/i);

    expect(screen.getByLabelText(/Category Name/i)).toBeDefined();
    expect(screen.queryByLabelText(/Theme Name/i)).toBeNull();
  });

  it("leaves the movie form able to add another without reopening", async () => {
    const user = userEvent.setup();
    renderMenu();

    await openForm(user, /movie/i);
    await user.type(screen.getByLabelText(/IMDb Link/i), "https://www.imdb.com/title/tt0100462/");
    await user.selectOptions(screen.getByLabelText(/Category/i), "c-1");
    await user.click(screen.getByRole("button", { name: /^add movie$/i }));

    await waitFor(() => expect(addMovieAction).toHaveBeenCalled());
    // Still open, and the IMDb field is ready for the next one.
    expect((screen.getByLabelText(/IMDb Link/i) as HTMLInputElement).value).toBe("");
  });
});
