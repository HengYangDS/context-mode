
| D-HQ-CI-WINRM-1 | tests/v2/plugins/inprocess-journal.test.mjs | Windows CI failed in after(): EPERM on rmSync because the opencode/pi entry holds its journal DB open until exit. Teardown now ignores EPERM/EBUSY on win32 only. No assertion changed. |
