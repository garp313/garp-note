Set ws = CreateObject("WScript.Shell") 
ws.CurrentDirectory = "C:\Users\tevoc\Documents\noteflow-fixed" 
ws.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr :3000') do taskkill /PID %a /F >nul 2>&1", 0, True 
ws.Run "cmd /c cd /d ""C:\Users\tevoc\Documents\noteflow-fixed"" && npm run dev", 0, False 
WScript.Sleep 8000 
ws.Run "cmd /c start http://localhost:3000", 0, False 
