import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SearchBar from "./SearchBar";

describe("SearchBar", () => {
  it("submits a trimmed search when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn().mockResolvedValue([]);
    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole("textbox", { name: /search spotify for tracks/i });
    await user.type(input, "  Digital Love{Enter}");

    expect(onSearch).toHaveBeenCalledWith("Digital Love");
  });

  it("disables both controls while an operation is running", () => {
    render(<SearchBar onSearch={vi.fn()} disabled />);

    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: /search/i })).toBeDisabled();
  });
});
