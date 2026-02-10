<a id="top">

<div style="display: flex; align-items: flex-start;">
  <img src="icon.png" alt="Logo" width="120" style="margin-right: 16px;">
  <div>
    <h3>Calendar</h1>
    <p>
      Easy Calendar date picker for edit & insert. 
    </p>
  </div>
</div>
</a>


Calendar is an open-source VS Code extension licensed under **GPL v3**.  
see [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE) for details. 


## Features

- snippets for inserting current date (eg CHANGELOG) using `//` (confluence like)
- insert date command providing a visual calendar
- recognize date and allow Calendar edit while keeping original format

## Extension Settings

This extension contributes the following settings:

* `calendar.dateFormat`: The format to use for dates. Use `default` (default) to automatically detect the format from the document or use system locale, or `ISO` for YYYY-MM-DD.
* `calendar.enabledLanguages`: List of languages where date recognition is enabled. Default is `["markdown", "plaintext", "javascript", "typescript"]`.
* `calendar.ambiguityResolution`: How to resolve ambiguous dates like 01/02/2023. Can be `DMY` (Day-Month-Year, default) or `MDY` (Month-Day-Year).

## Known Issues

Depending on system input format, first date insert may lead to a different format when editing latter on.

## Release Notes

### 0.0.2

Initial release
