import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OseAppShell from "@/components/OseAppShell";

describe("OseAppShell", () => {
  it("renders the mobile app shell", () => {
    render(<OseAppShell />);

    expect(screen.getByText("Open Scripture Explorer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bible" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Bible Reader" })).toBeTruthy();
  });
});
