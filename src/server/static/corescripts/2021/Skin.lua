-- 2021 look on the 2016 scripts: see through bar, dark round buttons, a dark chat window.
local RobloxGui = game:GetService("CoreGui"):WaitForChild("RobloxGui")
local DARK = Color3.new(0, 0, 0)

-- no bar, the buttons sit in their own dark pills
local PILLS = {
	Settings = true,
	Chat = true,
	Backpack = true,
	ShiftLock = true,
	LeaderstatsContainer = true,
	NameHealthContainer = true
}

local function pill(item)
	item.BackgroundColor3 = DARK
	item.BackgroundTransparency = 0.5
	item.BorderSizePixel = 0
end

local topbar = RobloxGui:WaitForChild("TopBarContainer")
topbar.BackgroundTransparency = 1
topbar.Changed:connect(function(prop)
	if prop == "BackgroundTransparency" and topbar.BackgroundTransparency < 1 then
		topbar.BackgroundTransparency = 1
	end
end)
local function walk(parent)
	for _, item in ipairs(parent:GetChildren()) do
		if PILLS[item.Name] then
			pill(item)
		end
		walk(item)
	end
end
walk(topbar)
topbar.DescendantAdded:connect(function(item)
	if PILLS[item.Name] then
		pill(item)
	end
end)

-- the logo took the hamburger's place
local function logo()
	local icon = topbar:FindFirstChild("SettingsIcon", true)
	if icon then
		icon.Image = "rbxasset://textures/roblox-logo.png"
		icon.ScaleType = Enum.ScaleType.Fit
		icon.Size = UDim2.new(0, 26, 0, 26)
		icon.Position = UDim2.new(0.5, -13, 0.5, -13)
	end
end
logo()
topbar.DescendantAdded:connect(function(item)
	if item.Name == "SettingsIcon" then
		logo()
	end
end)

-- the chat window stayed dark and a bit see through
local function darkChat(window)
	window.BackgroundColor3 = DARK
	window.BackgroundTransparency = 0.5
	window.Changed:connect(function(prop)
		if prop == "BackgroundTransparency" and window.BackgroundTransparency > 0.5 then
			window.BackgroundTransparency = 0.5
		end
	end)
end
local function darkBar(bar)
	local inner = bar:FindFirstChild("InnerBackground")
	if inner then
		inner.BackgroundColor3 = DARK
		inner.BackgroundTransparency = 0.5
	end
end
local window = RobloxGui:FindFirstChild("ChatWindowContainer", true)
if window then
	darkChat(window)
end
local bar = RobloxGui:FindFirstChild("ChatBarContainer", true)
if bar then
	darkBar(bar)
end
RobloxGui.DescendantAdded:connect(function(item)
	if item.Name == "ChatWindowContainer" then
		darkChat(item)
	elseif item.Name == "ChatBarContainer" then
		darkBar(item)
	end
end)

return true
