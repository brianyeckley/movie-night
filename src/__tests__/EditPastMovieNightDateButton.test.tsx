// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditPastMovieNightDateButton from "@/components/EditPastMovieNightDateButton";
import * as actions from "@/app/actions";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock("@/app/actions", () => ({
  updateWeekWatchDateAction: vi.fn(),
}));

describe("EditPastMovieNightDateButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the edit button initially", () => {
    render(
      <EditPastMovieNightDateButton
        weekId="week-1"
        currentClosedAt={new Date("2026-08-06T22:00:00Z")}
      />
    );

    const editBtn = screen.getByRole("button", { name: /Edit date watched/i });
    expect(editBtn).toBeDefined();
    expect(screen.queryByLabelText(/Edit date watched/i, { selector: "input" })).toBeNull();
  });

  it("opens the date input on click and cancels when clicking cancel", () => {
    render(
      <EditPastMovieNightDateButton
        weekId="week-1"
        currentClosedAt={new Date("2026-08-06T22:00:00Z")}
      />
    );

    const editBtn = screen.getByRole("button", { name: /Edit date watched/i });
    fireEvent.click(editBtn);

    const dateInput = screen.getByLabelText(/Edit date watched/i, { selector: "input" });
    expect(dateInput).toBeDefined();
    expect(screen.getByRole("button", { name: /Save/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeDefined();

    // Cancel closes the editor
    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByLabelText(/Edit date watched/i, { selector: "input" })).toBeNull();
  });

  it("calls updateWeekWatchDateAction and invokes callback on save", async () => {
    const onDateUpdated = vi.fn();
    vi.mocked(actions.updateWeekWatchDateAction).mockResolvedValueOnce({
      success: true,
      closedAt: "2026-08-10T22:00:00.000Z",
    });

    render(
      <EditPastMovieNightDateButton
        weekId="week-1"
        currentClosedAt={new Date("2026-08-06T22:00:00Z")}
        onDateUpdated={onDateUpdated}
      />
    );

    // Open edit mode
    fireEvent.click(screen.getByRole("button", { name: /Edit date watched/i }));

    const dateInput = screen.getByLabelText(/Edit date watched/i, { selector: "input" });
    fireEvent.change(dateInput, { target: { value: "2026-08-10" } });

    const saveBtn = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(actions.updateWeekWatchDateAction).toHaveBeenCalledWith("week-1", "2026-08-10");
      expect(onDateUpdated).toHaveBeenCalledWith(new Date("2026-08-10T22:00:00.000Z"));
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
