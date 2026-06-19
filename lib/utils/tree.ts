import type { Page, PageNode } from '@/types'

export function buildTree(pages: Page[]): PageNode[] {
  const map = new Map<string, PageNode>()
  const roots: PageNode[] = []

  // First pass: build map with empty children arrays
  for (const page of pages) {
    map.set(page.id, { ...page, children: [] })
  }

  // Second pass: attach children to parents
  for (const page of pages) {
    const node = map.get(page.id)!
    if (page.parent_id && map.has(page.parent_id)) {
      map.get(page.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort each level by sort_order
  const sortNodes = (nodes: PageNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order)
    for (const node of nodes) sortNodes(node.children)
  }
  sortNodes(roots)

  return roots
}

export function flatTree(nodes: PageNode[]): PageNode[] {
  const result: PageNode[] = []
  function walk(n: PageNode[]) {
    for (const node of n) {
      result.push(node)
      walk(node.children)
    }
  }
  walk(nodes)
  return result
}

export function findNode(tree: PageNode[], id: string): PageNode | null {
  for (const node of tree) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
  return null
}

export function getDescendantIds(tree: PageNode[], id: string): string[] {
  const node = findNode(tree, id)
  if (!node) return []
  const ids: string[] = []
  function collect(n: PageNode) {
    for (const child of n.children) {
      ids.push(child.id)
      collect(child)
    }
  }
  collect(node)
  return ids
}

export function getAffectedDeleteCount(tree: PageNode[], selectedIds: string[]): number {
  const allAffected = new Set<string>()
  for (const id of selectedIds) {
    allAffected.add(id)
    for (const desc of getDescendantIds(tree, id)) {
      allAffected.add(desc)
    }
  }
  return allAffected.size
}
