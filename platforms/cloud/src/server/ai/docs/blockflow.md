# blockflow (Scratch-like guided tutorials)

`::blockflow-player{src="… .sb3"}` plays a Blockflow tutorial, `::blockflow-editor{src="…"}`
lets readers create them. The project is a `.sb3` file — binary (a Scratch project
zip), so never write it with `write_file`; only reference an existing one with `src`.

    ::blockflow-player{src="/tutorial.sb3"}

Player attributes: `src`, `width` (default `100%`), `height` (default `600px`),
`aspectRatio` (default `4/3`).
