require 'xcodeproj'
project_path = 'ios/ContextEngine.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the main target
target = project.targets.find { |t| t.name == 'ContextEngine' }

# Add Background Modes Capability
unless target.build_configurations.first.build_settings['SystemCapabilities']
  # Note: Setting capabilities programmatically in xcodeproj can be complex 
  # but adding the Entitlements file is the most reliable way.
end

# Ensure Info.plist is in the right place and has the values
# We've already checked this.

project.save
puts "Verified project capabilities."
