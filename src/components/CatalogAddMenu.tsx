"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, FolderPlus, FolderTree, Plus, Sparkles, Film } from "lucide-react";
import { addCategoryAction, addSubcategoryAction, addThemeAction } from "@/app/actions";
import AddMovieForm from "@/components/AddMovieForm";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface Genre {
  id: string;
  name: string;
}

interface Theme {
  id: string;
  name: string;
}

interface CatalogAddMenuProps {
  categories: Category[];
  genres: Genre[];
  themes?: Theme[];
}

/** Which form the modal is showing; null when it is closed. */
type FormKind = "movie" | "category" | "subcategory" | "theme";

const FORM_TITLES: Record<FormKind, string> = {
  movie: "Add New Movie",
  category: "Add Category",
  subcategory: "Add Subcategory",
  theme: "Add Theme",
};

/**
 * The catalog's "Add" control: one dropdown in the page banner covering
 * everything that used to be a form in the right-hand rail, each opening in a
 * modal so the catalog list can have the full width of the page.
 */
export default function CatalogAddMenu({ categories, genres, themes = [] }: CatalogAddMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState<FormKind | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const topLevelCategories = categories.filter((c) => c.parentId === null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (form) {
      document.body.style.overflow = "hidden";
      return;
    }
    // Keep the overlay mounted until the close transition has finished.
    const timer = setTimeout(() => setIsRendered(false), 300);
    document.body.style.overflow = "";
    return () => clearTimeout(timer);
  }, [form]);

  useEffect(() => {
    if (!form && !menuOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (form) setForm(null);
      else setMenuOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [form, menuOpen]);

  const openForm = (kind: FormKind) => {
    setMenuOpen(false);
    // Mounted here rather than in an effect so opening is a single render.
    setIsRendered(true);
    setForm(kind);
  };

  const closeForm = () => setForm(null);

  const items: { kind: FormKind; label: string; icon: React.ReactNode }[] = [
    { kind: "movie", label: "Movie", icon: <Film size="1em" className="inline-icon" /> },
    { kind: "category", label: "Category", icon: <FolderPlus size="1em" className="inline-icon" /> },
    {
      kind: "subcategory",
      label: "Subcategory",
      icon: <FolderTree size="1em" className="inline-icon" />,
    },
    { kind: "theme", label: "Theme", icon: <Sparkles size="1em" className="inline-icon" /> },
  ];

  return (
    <>
      <div className="add-menu" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="add-menu-trigger"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Plus size="1em" className="inline-icon" />
          Add
          <ChevronDown size="1em" className="inline-icon add-menu-chevron" />
        </button>

        {menuOpen && (
          <div className="add-menu-dropdown" role="menu">
            {items.map((item) => (
              <button
                key={item.kind}
                type="button"
                className="add-menu-item"
                role="menuitem"
                onClick={() => openForm(item.kind)}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isRendered &&
        createPortal(
          <div onClick={closeForm} className={`modal-overlay ${form ? "open" : ""}`}>
            <div onClick={(e) => e.stopPropagation()} className="modal-card max-w-xl">
              <div className="modal-header">
                <span className="font-bold text-lg">
                  <Plus size="1em" className="inline-icon" /> {form ? FORM_TITLES[form] : ""}
                </span>
                <button type="button" onClick={closeForm} className="modal-close-btn">
                  &times;
                </button>
              </div>

              <div className="modal-form">
                {form === "movie" && (
                  <AddMovieForm categories={categories} genres={genres} themes={themes} />
                )}
                {form === "category" && <AddCategoryForm />}
                {form === "subcategory" && <AddSubcategoryForm parents={topLevelCategories} />}
                {form === "theme" && <AddThemeForm />}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/**
 * The outcome line the simple forms share.
 *
 * Each stays open after a successful add and clears itself, so several can be
 * created in a row; the list behind the modal has already revalidated.
 */
function FormResult({ error, success }: { error: string | null; success: string | null }) {
  if (error) {
    return (
      <div className="alert-box alert-error text-accent-color text-base font-semibold">{error}</div>
    );
  }
  if (success) {
    return <div className="alert-box text-base font-semibold">{success}</div>;
  }
  return null;
}

function AddCategoryForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const category = await addCategoryAction(name.trim());
        setName("");
        setSuccess(`"${category.name}" added.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add the category.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="form-container gap-md">
      <FormResult error={error} success={success} />
      <div className="form-group">
        <label htmlFor="cat-name" className="form-label">
          Category Name
        </label>
        <input
          id="cat-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Action"
          disabled={isPending}
          required
          className="form-input"
        />
      </div>
      <button type="submit" disabled={isPending} className="btn btn-primary btn-md w-full">
        {isPending ? "Creating..." : "Create Category"}
      </button>
    </form>
  );
}

function AddSubcategoryForm({ parents }: { parents: Category[] }) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !parentId) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const subcategory = await addSubcategoryAction(name.trim(), parentId);
        setName("");
        setSuccess(`"${subcategory.name}" added.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add the subcategory.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="form-container gap-md">
      <FormResult error={error} success={success} />
      <div className="form-group">
        <label htmlFor="sub-parent" className="form-label">
          Parent Category
        </label>
        <select
          id="sub-parent"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          disabled={isPending}
          required
          className="form-select"
        >
          <option value="">-- Select Parent --</option>
          {parents.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="sub-name" className="form-label">
          Subcategory Name
        </label>
        <input
          id="sub-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jean-Claude Van Damme"
          disabled={isPending}
          required
          className="form-input"
        />
      </div>
      <button type="submit" disabled={isPending} className="btn btn-primary btn-md w-full">
        {isPending ? "Creating..." : "Create Subcategory"}
      </button>
    </form>
  );
}

function AddThemeForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const theme = await addThemeAction(name.trim());
        setName("");
        setSuccess(`"${theme.name}" added.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add the theme.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="form-container gap-md">
      <FormResult error={error} success={success} />
      <div className="form-group">
        <label htmlFor="theme-name" className="form-label">
          Theme Name
        </label>
        <input
          id="theme-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Halloween, Christmas, 80s Slasher"
          disabled={isPending}
          required
          className="form-input"
        />
      </div>
      <button type="submit" disabled={isPending} className="btn btn-primary btn-md w-full">
        {isPending ? "Creating..." : "Create Theme"}
      </button>
    </form>
  );
}
