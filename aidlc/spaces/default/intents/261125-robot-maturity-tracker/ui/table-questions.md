# Data table questions

These questions shape the data table of your prototype. Answer with the letter of one option, or `X — <your own answer>`.

## Q1. [Product owner] How should people narrow the list?
[Anchor]: a-table-filters

Why we ask: filters decide whether the table needs a status filter and a text search, and which indexes the backend needs.

- A. They do not (just the list)
- B. By status
- C. By status and a text search on the title
- X. Other (please specify)

[Answer]: C

## Q2. [Product owner] In which order are the rows shown?
[Anchor]: a-table-sort

Why we ask: a fixed order is the cheapest to build; a choice adds sort controls to the header and a second index in the backend.

- A. Newest first, fixed
- B. People choose newest or oldest first, and may sort by title
- X. Other (please specify)

[Answer]: B

## Q3. [Product owner] What happens when the list is long?
[Anchor]: a-table-pager

Why we ask: showing only the first rows is simple; paging through every row adds a pager and a page-size choice.

- A. Show the first 50 rows only
- B. Page through all rows; people choose the page size (10, 25, 50 or 100)
- X. Other (please specify)

[Answer]: B

## Q4. [Product owner] Who edits the rows?
[Anchor]: a-table-add

Why we ask: this decides whether the screen has an "Add item" action and row editing. The backend always supports creating, changing and deleting rows.

- A. Read-only list
- B. People add and edit rows
- X. Other (please specify)

[Answer]: B

## Q5. [Tech lead] Roughly how many rows will the table hold after one year?

Why we ask: this is a sizing check, not a screen choice. Up to about 100,000 rows the design fits as it is; far above that, the single list index needs sharding.

- A. Fewer than 1,000
- B. Between 1,000 and 100,000
- C. More than 100,000
- X. Other (please specify)

[Answer]: B
