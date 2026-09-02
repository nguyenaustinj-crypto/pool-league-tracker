"use client";

import { useState } from "react";

export default function DeleteConfirmForm({
  action,
  expectedName,
}: {
  action: (formData: FormData) => void;
  expectedName: string;
}) {
  const [value, setValue] = useState("");
  const matches = value === expectedName;

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="text"
        name="confirmName"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Type "${expectedName}" to confirm`}
        className="flex-1 rounded-md border px-3 py-2"
      />
      <button
        type="submit"
        disabled={!matches}
        className="shrink-0 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        Delete
      </button>
    </form>
  );
}
