; Autostart checkbox on the assisted NSIS finish page (repurposes MUI "readme" slot).
; electron-builder already provides the "Run app now" checkbox via runAfterFinish.

!ifndef BUILD_UNINSTALLER
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "elizon beim Windows-Start automatisch öffnen"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION AddToStartup

  Function AddToStartup
    CreateShortCut "$SMSTARTUP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  FunctionEnd
!endif

!macro customUnInstall
  Delete "$SMSTARTUP\${PRODUCT_FILENAME}.lnk"
  ; Also clear Electron login-item registry value if present
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "elizon"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.elizon"
!macroend
