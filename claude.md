1. For the MVP I want only 100 lines per dataset.
2. For background task monitoring, spawn a haiku Task agent (model: "haiku") to poll and report when the Bash task finishes. Use --skip-existing flag on runners so they can resume after crashes. Always add tqdm for long runs.
