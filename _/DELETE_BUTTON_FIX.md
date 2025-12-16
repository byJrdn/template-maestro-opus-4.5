# Delete Button Permission Fix - Manual Instructions

## File to Edit:
`js/template-manager.js`

## Lines to Find (around line 231-237):
```javascript
    </button>
    <button class="p-2 text-slate-500 hover:text-error-600 hover:bg-error-50 rounded-lg" 
            onclick="event.stopPropagation(); deleteTemplate('${template.id}', '${template.name.replace(/'/g, "\\'")}'
);"
            title="Delete">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
    </button>
```

## Replace With:
```javascript
    </button>
    ${window.userRole === 'admin' ? `
    <button class="p-2 text-slate-500 hover:text-error-600 hover:bg-error-50 rounded-lg" 
            onclick="event.stopPropagation(); deleteTemplate('${template.id}', '${template.name.replace(/'/g, "\\'")}'
);"
            title="Delete (Admin Only)">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
    </button>
    ` : ''}
```

## What Changed:
1. Wrapped the entire button in `${window.userRole === 'admin' ? ` ... ` : ''}`
2. Changed title from "Delete" to "Delete (Admin Only)"
3. Added closing `}` at the end

This makes the delete button only render for admin users!
