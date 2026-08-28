// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useVoteSelection } from "@/hooks/useVoteSelection";

interface HarnessProps {
  initialVotes?: string[];
  maxVotes: number;
  action?: (ids: string[]) => Promise<unknown>;
  options?: string[];
}

/**
 * Minimal form driven by the hook, standing in for the real voting forms so
 * the selection rules can be exercised without any server plumbing.
 */
function Harness({
  initialVotes = [],
  maxVotes,
  action = async () => {},
  options = ["a", "b", "c"],
}: HarnessProps) {
  const vote = useVoteSelection({ initialVotes, maxVotes });

  return (
    <form
      onSubmit={vote.handleSubmit({
        emptyMessage: "Pick something first.",
        successMessage: "Saved!",
        action,
      })}
    >
      {options.map((id) => (
        <label key={id}>
          {id}
          <input
            type={vote.isSingle ? "radio" : "checkbox"}
            name="opt"
            aria-label={id}
            checked={vote.isChecked(id)}
            disabled={vote.isDisabled(id) || vote.isPending}
            onChange={(e) => vote.toggle(id, e.target.checked)}
          />
        </label>
      ))}
      {vote.error && <p role="alert">{vote.error}</p>}
      {vote.toastMsg && <p role="status">{vote.toastMsg}</p>}
      <button type="submit">Submit</button>
    </form>
  );
}

const box = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

describe("useVoteSelection", () => {
  it("seeds the user's existing votes as checked", () => {
    render(<Harness maxVotes={3} initialVotes={["b"]} />);

    expect(box("a").checked).toBe(false);
    expect(box("b").checked).toBe(true);
  });

  it("disables the remaining options once the limit is reached", async () => {
    render(<Harness maxVotes={2} />);

    await userEvent.click(box("a"));
    await userEvent.click(box("b"));

    expect(box("a").disabled).toBe(false);
    expect(box("b").disabled).toBe(false);
    // Third option is locked out, but the two picks can still be undone.
    expect(box("c").disabled).toBe(true);
  });

  it("frees up a slot again when a pick is removed", async () => {
    render(<Harness maxVotes={2} />);

    await userEvent.click(box("a"));
    await userEvent.click(box("b"));
    expect(box("c").disabled).toBe(true);

    await userEvent.click(box("a"));
    expect(box("c").disabled).toBe(false);
  });

  // Round 2c, Round 4 and the in-person tiebreakers are all single-choice.
  it("replaces the choice rather than blocking it when maxVotes is 1", async () => {
    render(<Harness maxVotes={1} />);

    await userEvent.click(box("a"));
    expect(box("a").checked).toBe(true);
    // Nothing is disabled - the user can switch freely.
    expect(box("b").disabled).toBe(false);

    await userEvent.click(box("b"));
    expect(box("b").checked).toBe(true);
    expect(box("a").checked).toBe(false);
  });

  it("refuses an empty submission and does not call the action", async () => {
    const action = vi.fn();
    render(<Harness maxVotes={3} action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Pick something first."
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("submits the selected ids and reports success", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<Harness maxVotes={3} action={action} />);

    await userEvent.click(box("a"));
    await userEvent.click(box("c"));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(action).toHaveBeenCalledWith(["a", "c"]));
    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      "Saved!"
    );
  });

  it("surfaces the server's message when the action rejects", async () => {
    // The hook logs the failure; that is deliberate, so keep it out of the run.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = vi.fn().mockRejectedValue(new Error("Voting is closed."));
    render(<Harness maxVotes={3} action={action} />);

    await userEvent.click(box("a"));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Voting is closed."
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("clears a previous error as soon as the user changes their picks", async () => {
    render(<Harness maxVotes={3} />);

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toBeDefined();

    await userEvent.click(box("a"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
