// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Header from "@/components/Header";

vi.mock("@/app/actions/user", () => ({
  logoutAction: vi.fn(),
}));

describe("Header component with Google Drive integration", () => {
  const mockUser = {
    id: "user-1",
    name: "Brian",
    username: "brian",
    role: "ADMIN",
  };

  it("renders Google Drive link next to user name when logged in with default URL", () => {
    render(<Header currentUser={mockUser} />);

    // Check desktop user trigger
    expect(screen.getByText("Brian")).toBeTruthy();

    // Check Google Drive links (top bar desktop & mobile)
    const driveLinks = screen.getAllByRole("link", { name: "Google Drive" }) as HTMLAnchorElement[];
    expect(driveLinks.length).toBeGreaterThanOrEqual(1);

    driveLinks.forEach((link) => {
      expect(link.getAttribute("href")).toBe("https://drive.google.com/");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });
  });

  it("uses custom googleDriveUrl prop when provided", () => {
    const customUrl = "https://drive.google.com/drive/folders/test-folder-123";
    render(<Header currentUser={mockUser} googleDriveUrl={customUrl} />);

    const driveLinks = screen.getAllByRole("link", { name: "Google Drive" }) as HTMLAnchorElement[];
    driveLinks.forEach((link) => {
      expect(link.getAttribute("href")).toBe(customUrl);
    });
  });

  it("includes Google Drive link inside the account dropdown menu", () => {
    render(<Header currentUser={mockUser} />);

    const userMenuButton = screen.getByRole("button", { name: /Brian/i });
    fireEvent.click(userMenuButton);

    const dropdownLinks = screen.getAllByRole("menuitem");
    const driveMenuItem = dropdownLinks.find((item) =>
      item.textContent?.includes("Google Drive")
    );
    expect(driveMenuItem).toBeDefined();
    expect(driveMenuItem?.getAttribute("href")).toBe("https://drive.google.com/");
  });

  it("does not render user navigation or Google Drive button when user is logged out", () => {
    render(<Header currentUser={null} />);

    expect(screen.queryByText("Brian")).toBeNull();
    expect(screen.queryByRole("link", { name: "Google Drive" })).toBeNull();
  });
});
