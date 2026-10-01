-- 2012 core scripts: settings, chat, player list, backpack, notifications. No top bar, the 2014 health bar.
-- the 2012 starter script (asset 37801174) with AddCoreScript swapped for a fetch, this client has it disabled

local touchEnabled = false
pcall(function() touchEnabled = game:GetService("UserInputService").TouchEnabled end)

local baseUrl = game:GetService("ContentProvider").BaseUrl:gsub("/*$", "") .. "/"

local function waitForChild(instance, name)
	while not instance:FindFirstChild(name) do
		instance.ChildAdded:wait()
	end
end

-- loadstring is off on clients, a module with the source set runs the same way
local function AddCoreScript(id, parent, name)
	spawn(function()
		local ok, err = pcall(function()
			local script = Instance.new("ModuleScript")
			script.Name = name:match("([^/]+)$") or tostring(id)
			script.Source = game:HttpGet(baseUrl .. "corescripts/2012/" .. id .. ".lua") .. "\nreturn true\n"
			script.Parent = parent
			require(script)
		end)
		if not ok then
			print("2012 core script " .. name .. ": " .. tostring(err))
		end
	end)
end

waitForChild(game:GetService("CoreGui"), "RobloxGui")
local screenGui = game:GetService("CoreGui"):FindFirstChild("RobloxGui")

if not touchEnabled then
	AddCoreScript(36868952, screenGui, "CoreScripts/ToolTip")
	AddCoreScript(46295865, screenGui, "CoreScripts/Settings")
end

AddCoreScript(39250922, screenGui, "CoreScripts/MainBotChatScript")
AddCoreScript(48488453, screenGui, "CoreScripts/PopupScript")
AddCoreScript(48488400, screenGui, "CoreScripts/NotificationScript")
AddCoreScript(97188758, screenGui, "CoreScripts/ChatScript")
AddCoreScript(153556822, screenGui, "CoreScripts/HealthScript")

if not touchEnabled or screenGui.AbsoluteSize.Y > 600 then
	AddCoreScript(48488237, screenGui, "CoreScripts/PlayerListScript")
end

AddCoreScript(53878049, screenGui, "CoreScripts/BackpackScripts/BackpackBuilder")
waitForChild(screenGui, "CurrentLoadout")
waitForChild(screenGui, "Backpack")
local Backpack = screenGui.Backpack
AddCoreScript(89449095, Backpack, "CoreScripts/BackpackScripts/BackpackManager")
AddCoreScript(89449010, Backpack, "CoreScripts/BackpackScripts/BackpackGear")
AddCoreScript(53878059, screenGui.CurrentLoadout, "CoreScripts/BackpackScripts/LoadoutScript")

if touchEnabled then
	waitForChild(screenGui, "ControlFrame")
	waitForChild(screenGui.ControlFrame, "BottomLeftControl")
	screenGui.ControlFrame.BottomLeftControl.Visible = false
end

return true
