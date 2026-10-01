-- 2014 core scripts: settings, chat, player list, backpack, health, notifications. No top bar.
-- 2014 starter script (asset 37801172) with AddCoreScript swapped for a fetch, this client has it disabled

local scriptContext = game:GetService("ScriptContext")
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
			script.Source = game:HttpGet(baseUrl .. "corescripts/2014/" .. id .. ".lua") .. "\nreturn true\n"
			script.Parent = parent
			require(script)
		end)
		if not ok then
			print("2014 core script " .. name .. ": " .. tostring(err))
		end
	end)
end

waitForChild(game:GetService("CoreGui"), "RobloxGui")
local screenGui = game:GetService("CoreGui"):FindFirstChild("RobloxGui")

-- SettingsScript
AddCoreScript(46295863, screenGui, "CoreScripts/Settings")

if not touchEnabled then
	-- ToolTipper  (creates tool tips for gui)
	AddCoreScript(36868950, screenGui, "CoreScripts/ToolTip")
else
	AddCoreScript(153556783, screenGui, "CoreScripts/TouchControls")
end

-- MainBotChatScript
AddCoreScript(39250920, screenGui, "CoreScripts/MainBotChatScript")

-- Developer Console Script
AddCoreScript(157877000, screenGui, "CoreScripts/DeveloperConsole")

-- Popup Script
AddCoreScript(48488451, screenGui, "CoreScripts/PopupScript")
-- Friend Notification Script
AddCoreScript(48488398, screenGui, "CoreScripts/NotificationScript")
-- Chat script
AddCoreScript(97188756, screenGui, "CoreScripts/ChatScript")
-- Purchase Prompt Script
AddCoreScript(107893730, screenGui, "CoreScripts/PurchasePromptScript")
-- Health Script
AddCoreScript(153556822, screenGui, "CoreScripts/HealthScript")

if not touchEnabled then
	AddCoreScript(48488235, screenGui, "CoreScripts/PlayerListScript")
elseif screenGui.AbsoluteSize.Y > 600 then
	AddCoreScript(48488235, screenGui, "CoreScripts/PlayerListScript")
else
	delay(5, function()
		if screenGui.AbsoluteSize.Y >= 600 then
			AddCoreScript(48488235, screenGui, "CoreScripts/PlayerListScript")
		end
	end)
end

-- Backpack Builder, creates most of the backpack gui
AddCoreScript(53878047, screenGui, "CoreScripts/BackpackScripts/BackpackBuilder")

waitForChild(screenGui, "CurrentLoadout")
waitForChild(screenGui, "Backpack")
local Backpack = screenGui.Backpack

-- Manager handles all big backpack state changes, other scripts subscribe to this and do things accordingly
AddCoreScript(89449093, Backpack, "CoreScripts/BackpackScripts/BackpackManager")
-- Backpack Gear (handles all backpack gear tab stuff)
AddCoreScript(89449008, Backpack, "CoreScripts/BackpackScripts/BackpackGear")
-- Loadout Script, used for gear hotkeys
AddCoreScript(53878057, screenGui.CurrentLoadout, "CoreScripts/BackpackScripts/LoadoutScript")

if touchEnabled then
	AddCoreScript(152908679, screenGui, "CoreScripts/ContextActionTouch")

	waitForChild(screenGui, "ControlFrame")
	waitForChild(screenGui.ControlFrame, "BottomLeftControl")
	screenGui.ControlFrame.BottomLeftControl.Visible = false
end

return true
