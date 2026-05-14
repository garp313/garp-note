Set ws = CreateObject("WScript.Shell") 
ws.CurrentDirectory = "C:\Users\tevoc\Documents\noteflow-fixed" 
ws.Run "cmd /c cd /d ""C:\Users\tevoc\Documents\noteflow-fixed"" && timeout /t 3 /nobreak >nul && start http://localhost:3000", 0, False 
ws.Run "cmd /c cd /d ""C:\Users\tevoc\Documents\noteflow-fixed"" && npm run dev", 0, False 
