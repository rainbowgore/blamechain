#!/usr/bin/env node

/**
 * Script to find and remove internal comments and emojis from JavaScript files
 * 
 * This script searches recursively through all JavaScript files in the src directory,
 * identifies and removes developer comments and emojis, and preserves code structure
 * and functionality.
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

// Make fs functions return promises
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const stat = util.promisify(fs.stat);
const mkdir = util.promisify(fs.mkdir);

// Patterns to match developer comments
const INTERNAL_COMMENT_PATTERNS = [
  // Standard internal comment patterns
  /\/\/\s*(TODO|FIXME|XXX|HACK|BUG|NOTE|REVIEW|UNDONE).*?$/gm,
  // Other informal comment markers
  /\/\/\s*(?:debug|temporary|remove this|cleanup|refactor).*?$/gim,
];

// Patterns to match emojis and emoticons
const EMOJI_PATTERNS = [
  // Unicode emoji ranges (covers most common emojis)
  /[\u{1F300}-\u{1F5FF}|\u{1F600}-\u{1F64F}|\u{1F680}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|\u{1F900}-\u{1F9FF}|\u{1F1E0}-\u{1F1FF}]/gu,
  // Text emoticons
  /(?::|;|=)(?:-)?(?:\)|D|P|\(|\/|\[|\])/g,
  // Named emoji codes
  /:[a-z_]+:/g,
];

// Files and directories to ignore
const IGNORE_PATHS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  'test',
  'tests',
  'vendor'
];

// Backup directory
const BACKUP_DIR = path.join(process.cwd(), 'backup-before-cleanup');

// Stats for reporting
const stats = {
  filesScanned: 0,
  filesModified: 0,
  internalCommentsRemoved: 0,
  emojisRemoved: 0,
  errors: [],
};

/**
 * Creates a backup of a file before modifying it
 */
async function backupFile(filePath) {
  try {
    const relativePath = path.relative(process.cwd(), filePath);
    const backupPath = path.join(BACKUP_DIR, relativePath);
    const backupDir = path.dirname(backupPath);
    
    // Create backup directory if it doesn't exist
    await mkdir(backupDir, { recursive: true });
    
    // Copy file to backup
    const content = await readFile(filePath, 'utf8');
    await writeFile(backupPath, content, 'utf8');
    
    return true;
  } catch (error) {
    stats.errors.push(`Failed to backup ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Processes a file to remove internal comments and emojis
 */
async function processFile(filePath) {
  try {
    stats.filesScanned++;
    
    // Read file content
    let content = await readFile(filePath, 'utf8');
    const originalContent = content;
    
    // Count initial matches
    let internalCommentCount = 0;
    let emojiCount = 0;
    
    // Replace internal comments with empty strings or just the necessary code parts
    INTERNAL_COMMENT_PATTERNS.forEach(pattern => {
      content = content.replace(pattern, (match) => {
        internalCommentCount++;
        // If the comment is on its own line, replace with empty string
        if (match.trim().startsWith('//')) {
          return '';
        }
        // Otherwise, just remove the comment part, keeping code
        const codePartMatch = match.match(/^(.*?)\/\//);
        return codePartMatch ? codePartMatch[1] : '';
      });
    });
    
    // Replace emojis with empty strings
    EMOJI_PATTERNS.forEach(pattern => {
      content = content.replace(pattern, (match) => {
        emojiCount++;
        return '';
      });
    });
    
    // If file was modified, back it up and save changes
    if (content !== originalContent) {
      const backedUp = await backupFile(filePath);
      
      if (backedUp) {
        await writeFile(filePath, content, 'utf8');
        stats.filesModified++;
        stats.internalCommentsRemoved += internalCommentCount;
        stats.emojisRemoved += emojiCount;
        
        console.log(`Modified: ${filePath}`);
        console.log(`  - Removed ${internalCommentCount} internal comments`);
        console.log(`  - Removed ${emojiCount} emojis/emoticons`);
      }
    }
  } catch (error) {
    stats.errors.push(`Error processing ${filePath}: ${error.message}`);
  }
}

/**
 * Recursively walks a directory and processes JavaScript files
 */
async function walkDirectory(dirPath) {
  // Read directory entries
  const entries = await readdir(dirPath, { withFileTypes: true });
  
  // Process each entry
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    // Skip ignored directories
    if (entry.isDirectory() && IGNORE_PATHS.some(ignore => entry.name === ignore || fullPath.includes(`/${ignore}/`))) {
      continue;
    }
    
    if (entry.isDirectory()) {
      // Recursively process subdirectory
      await walkDirectory(fullPath);
    } else if (entry.isFile() && /\.js$/.test(entry.name)) {
      // Process JavaScript file
      await processFile(fullPath);
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const startTime = Date.now();
    
    // Create backup directory
    await mkdir(BACKUP_DIR, { recursive: true });
    console.log(`Created backup directory: ${BACKUP_DIR}`);
    
    // Process all JavaScript files in src directory
    const srcDir = path.join(process.cwd(), 'src');
    console.log(`Starting to process files in: ${srcDir}`);
    
    await walkDirectory(srcDir);
    
    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n========== SUMMARY ==========');
    console.log(`Scanned ${stats.filesScanned} JavaScript files in ${duration} seconds`);
    console.log(`Modified ${stats.filesModified} files`);
    console.log(`Removed ${stats.internalCommentsRemoved} internal comments`);
    console.log(`Removed ${stats.emojisRemoved} emojis/emoticons`);
    
    if (stats.errors.length > 0) {
      console.log('\nErrors encountered:');
      stats.errors.forEach(error => console.error(`- ${error}`));
    }
    
    console.log('\nBackups of all modified files were created in:');
    console.log(BACKUP_DIR);
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});