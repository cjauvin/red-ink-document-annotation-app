import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import * as fabric from 'fabric';

export const AnnotationCanvas = forwardRef(function AnnotationCanvas({
  width,
  height,
  scale = 1,
  activeTool,
  activeColor,
  onCanvasChange,
  initialData,
  onHistoryChange,
  onFocus,
  readOnly = false,
}, ref) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef(null);
  const tempObjectRef = useRef(null);
  const drawPointsRef = useRef([]);
  const historyRef = useRef([]);
  const prevDimensionsRef = useRef({ width, height });
  const justExitedTextEditRef = useRef(false);
  const onFocusRef = useRef(onFocus);
  const isMountedRef = useRef(true);
  const [canvasReady, setCanvasReady] = useState(false);

  // Track mounted state to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep onFocus ref updated without triggering re-renders
  useEffect(() => {
    onFocusRef.current = onFocus;
  }, [onFocus]);

  // Configure textbox objects with uniform scaling and appropriate controls
  const configureTextbox = useCallback((obj) => {
    if (obj.type === 'textbox') {
      obj.lockUniScaling = true;
      obj.setControlsVisibility({
        ml: true,   // middle left - controls width
        mr: true,   // middle right - controls width
        mt: false,  // middle top - disabled (height is auto)
        mb: false,  // middle bottom - disabled (height is auto)
        tl: true,   // top left corner - uniform scale
        tr: true,   // top right corner - uniform scale
        bl: true,   // bottom left corner - uniform scale
        br: true,   // bottom right corner - uniform scale
        mtr: true,  // rotation control
      });
    }
  }, []);

  // Normalize annotation data to percentages (0-1) for storage
  // This ensures annotations appear at the same relative position on any device
  const normalizeData = useCallback((json) => {
    if (!json || !json.objects || !width || !height) return json;

    const normalizeObject = (obj) => {
      // Get effective scale factors for baking
      const effectiveScaleX = obj.scaleX || 1;
      const effectiveScaleY = obj.scaleY || 1;

      const normalized = {
        ...obj,
        // Position as percentage of canvas dimensions
        left: obj.left / width,
        top: obj.top / height,
        // Reset scale to 1 after baking into dimensions
        scaleX: 1,
        scaleY: 1,
      };

      // Bake scaleX/scaleY into dimensions and normalize to percentages
      // Use width as reference for horizontal dims, height for vertical
      if (obj.width) normalized.width = (obj.width * effectiveScaleX) / width;
      if (obj.height) normalized.height = (obj.height * effectiveScaleY) / height;

      // Font size as percentage of height (for consistent text scaling)
      if (obj.fontSize) normalized.fontSize = (obj.fontSize * effectiveScaleY) / height;

      // Line coordinates as percentages
      if (obj.x1 !== undefined) normalized.x1 = (obj.x1 * effectiveScaleX) / width;
      if (obj.y1 !== undefined) normalized.y1 = (obj.y1 * effectiveScaleY) / height;
      if (obj.x2 !== undefined) normalized.x2 = (obj.x2 * effectiveScaleX) / width;
      if (obj.y2 !== undefined) normalized.y2 = (obj.y2 * effectiveScaleY) / height;

      // Stroke width as percentage of width
      if (obj.strokeWidth) normalized.strokeWidth = (obj.strokeWidth * effectiveScaleX) / width;

      // Radius as percentage of width
      if (obj.radius) normalized.radius = (obj.radius * effectiveScaleX) / width;

      return normalized;
    };

    return {
      ...json,
      objects: json.objects.map(normalizeObject),
    };
  }, [width, height]);

  // Expose undo and clear methods to parent
  useImperativeHandle(ref, () => ({
    undo: () => {
      if (!fabricRef.current || historyRef.current.length <= 1 || !isMountedRef.current) return;

      historyRef.current.pop();
      const previousState = historyRef.current[historyRef.current.length - 1];

      fabricRef.current.clear();
      if (previousState.objects && previousState.objects.length > 0) {
        fabric.util.enlivenObjects(previousState.objects).then((objects) => {
          if (!isMountedRef.current) return;
          objects.forEach((obj) => {
            configureTextbox(obj);
            fabricRef.current?.add(obj);
          });
          fabricRef.current?.renderAll();
        });
      }

      if (isMountedRef.current) onHistoryChange?.(historyRef.current.length > 1);
      // Normalize before sending to parent
      if (isMountedRef.current) onCanvasChange?.(normalizeData(previousState));
    },
    clear: () => {
      if (!fabricRef.current || !isMountedRef.current) return;

      fabricRef.current.clear();
      const json = fabricRef.current.toJSON();
      historyRef.current.push(json);
      if (isMountedRef.current) onHistoryChange?.(historyRef.current.length > 1);
      // Normalize before sending to parent (though clear is already empty)
      if (isMountedRef.current) onCanvasChange?.(normalizeData(json));
    },
  }), [onCanvasChange, onHistoryChange, normalizeData, configureTextbox]);

  // Denormalize annotation data from percentages to pixel coordinates
  // targetWidth/targetHeight are the canvas dimensions on the current device
  const denormalizeData = useCallback((json, targetWidth, targetHeight) => {
    if (!json || !json.objects || !targetWidth || !targetHeight) return json;

    const denormalizeObject = (obj) => {
      const denormalized = {
        ...obj,
        // Convert percentages back to pixel coordinates
        left: obj.left * targetWidth,
        top: obj.top * targetHeight,
        // scaleX/scaleY are stored as 1
        scaleX: 1,
        scaleY: 1,
      };

      // Convert dimensions from percentages to pixels
      if (obj.width) denormalized.width = obj.width * targetWidth;
      if (obj.height) denormalized.height = obj.height * targetHeight;

      // Font size from percentage of height
      if (obj.fontSize) denormalized.fontSize = obj.fontSize * targetHeight;

      // Line coordinates from percentages
      if (obj.x1 !== undefined) denormalized.x1 = obj.x1 * targetWidth;
      if (obj.y1 !== undefined) denormalized.y1 = obj.y1 * targetHeight;
      if (obj.x2 !== undefined) denormalized.x2 = obj.x2 * targetWidth;
      if (obj.y2 !== undefined) denormalized.y2 = obj.y2 * targetHeight;

      // Stroke width from percentage of width
      if (obj.strokeWidth) denormalized.strokeWidth = obj.strokeWidth * targetWidth;

      // Radius from percentage of width
      if (obj.radius) denormalized.radius = obj.radius * targetWidth;

      return denormalized;
    };

    return {
      ...json,
      objects: json.objects.map(denormalizeObject),
    };
  }, []);

  // Initialize canvas once on mount
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      selection: !readOnly,
      isDrawingMode: false,
      enableRetinaScaling: false,
    });

    fabricRef.current = canvas;
    prevDimensionsRef.current = { width, height };
    setCanvasReady(true);

    // Load initial data immediately after canvas creation
    if (initialData && initialData.objects && initialData.objects.length > 0) {
      // Denormalize from percentages to pixel coordinates
      const denormalized = denormalizeData(initialData, width, height);

      fabric.util.enlivenObjects(denormalized.objects).then((objects) => {
        objects.forEach((obj) => {
          if (readOnly) {
            obj.selectable = false;
            obj.evented = false;
          }
          configureTextbox(obj);
          canvas.add(obj);
        });
        canvas.renderAll();
        historyRef.current = [canvas.toJSON()];
        if (isMountedRef.current) onHistoryChange?.(historyRef.current.length > 1);
      });
    } else {
      historyRef.current = [canvas.toJSON()];
      if (isMountedRef.current) onHistoryChange?.(false);
    }

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - initialData is captured at creation time

  // Update canvas size when dimensions change (zoom)
  // Instead of scaling objects, we normalize → clear → denormalize
  // This uses the same logic as cross-device and is more reliable
  useEffect(() => {
    if (!fabricRef.current || !width || !height) return;

    const canvas = fabricRef.current;
    const prev = prevDimensionsRef.current;

    // If dimensions changed, reload objects at new size
    if ((prev.width !== width || prev.height !== height) && prev.width > 0 && prev.height > 0) {
      // Get current state and normalize it using OLD dimensions
      const currentJson = canvas.toJSON();

      if (currentJson.objects && currentJson.objects.length > 0) {
        // Normalize using old dimensions
        const normalized = {
          ...currentJson,
          objects: currentJson.objects.map(obj => {
            const effectiveScaleX = obj.scaleX || 1;
            const effectiveScaleY = obj.scaleY || 1;

            const norm = {
              ...obj,
              left: obj.left / prev.width,
              top: obj.top / prev.height,
              scaleX: 1,
              scaleY: 1,
            };

            if (obj.width) norm.width = (obj.width * effectiveScaleX) / prev.width;
            if (obj.height) norm.height = (obj.height * effectiveScaleY) / prev.height;
            if (obj.fontSize) norm.fontSize = (obj.fontSize * effectiveScaleY) / prev.height;
            if (obj.strokeWidth) norm.strokeWidth = (obj.strokeWidth * effectiveScaleX) / prev.width;
            if (obj.radius) norm.radius = (obj.radius * effectiveScaleX) / prev.width;

            return norm;
          }),
        };

        // Denormalize using NEW dimensions
        const denormalized = denormalizeData(normalized, width, height);

        // Clear and reload
        canvas.clear();
        canvas.setDimensions({ width, height });

        fabric.util.enlivenObjects(denormalized.objects).then((objects) => {
          objects.forEach((obj) => {
            if (readOnly) {
              obj.selectable = false;
              obj.evented = false;
            }
            configureTextbox(obj);
            canvas.add(obj);
          });
          canvas.renderAll();
          historyRef.current = [canvas.toJSON()];
        });
      } else {
        // No objects, just update dimensions
        canvas.setDimensions({ width, height });
        canvas.renderAll();
      }
    } else {
      // First render or no change, just set dimensions
      canvas.setDimensions({ width, height });
      canvas.renderAll();
    }

    prevDimensionsRef.current = { width, height };
  }, [width, height, denormalizeData, configureTextbox, readOnly]);

  // Save canvas state to history
  const saveToHistory = useCallback(() => {
    if (!fabricRef.current || !isMountedRef.current) return;

    const json = fabricRef.current.toJSON();
    historyRef.current.push(json);
    if (isMountedRef.current) onHistoryChange?.(historyRef.current.length > 1);

    // Normalize before sending to parent (store as percentages)
    const normalizedJson = normalizeData(json);
    if (isMountedRef.current) onCanvasChange?.(normalizedJson);
  }, [onCanvasChange, onHistoryChange, normalizeData]);

  // Handle mouse events for drawing
  useEffect(() => {
    if (!fabricRef.current || readOnly) return;

    const canvas = fabricRef.current;

    const handleMouseDown = (opt) => {
      // Notify parent that this canvas is now active
      onFocusRef.current?.();

      if (!activeTool || activeTool === 'select') return;

      // Don't start drawing if clicking on an existing object (allow selection/resize)
      if (opt.target) return;

      // Fabric.js v6 uses scenePoint instead of getPointer
      const rawPointer = opt.scenePoint || opt.pointer;
      // Clamp coordinates to canvas boundaries
      const pointer = {
        x: Math.max(0, Math.min(rawPointer.x, width)),
        y: Math.max(0, Math.min(rawPointer.y, height)),
      };
      isDrawingRef.current = true;
      startPointRef.current = pointer;

      // Disable selection during drawing
      canvas.selection = false;

      if (activeTool === 'text') {
        // If we just exited text editing, consume this click to deselect only
        if (justExitedTextEditRef.current) {
          justExitedTextEditRef.current = false;
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          isDrawingRef.current = false;
          canvas.selection = true;
          return;
        }

        // Clamp text position to stay within horizontal bounds
        const textWidth = 300;
        const clampedX = Math.max(0, Math.min(pointer.x, width - textWidth));

        const text = new fabric.Textbox('', {
          left: clampedX,
          top: pointer.y,
          fontSize: 18,
          fill: activeColor,
          fontFamily: 'Arial',
          width: textWidth,
          editable: true,
          originX: 'left',
          originY: 'top',
          lockUniScaling: true,  // Force uniform scaling (both directions at once)
        });
        // Configure controls: side handles for width, corners for uniform scaling
        text.setControlsVisibility({
          ml: true,   // middle left - controls width
          mr: true,   // middle right - controls width
          mt: false,  // middle top - disabled (height is auto)
          mb: false,  // middle bottom - disabled (height is auto)
          tl: true,   // top left corner - uniform scale
          tr: true,   // top right corner - uniform scale
          bl: true,   // bottom left corner - uniform scale
          br: true,   // bottom right corner - uniform scale
          mtr: true,  // rotation control
        });
        canvas.add(text);
        canvas.setActiveObject(text);

        // Enter editing mode after a brief delay to ensure canvas is ready
        setTimeout(() => {
          text.enterEditing();
          // Focus the hidden textarea that Fabric uses for text input
          const hiddenTextarea = document.querySelector('.upper-canvas')?.parentElement?.querySelector('textarea');
          if (hiddenTextarea) {
            hiddenTextarea.focus();
          }
        }, 50);

        isDrawingRef.current = false;
        // Don't save to history yet - wait for editing:exited event
      }

      if (activeTool === 'draw') {
        drawPointsRef.current = [pointer];
      }
    };

    const handleMouseMove = (opt) => {
      if (!isDrawingRef.current || !startPointRef.current) return;
      if (activeTool === 'text') return;

      // Fabric.js v6 uses scenePoint instead of getPointer
      const rawPointer = opt.scenePoint || opt.pointer;
      // Clamp coordinates to canvas boundaries
      const pointer = {
        x: Math.max(0, Math.min(rawPointer.x, width)),
        y: Math.max(0, Math.min(rawPointer.y, height)),
      };
      const start = startPointRef.current;

      // Remove temp object
      if (tempObjectRef.current) {
        canvas.remove(tempObjectRef.current);
      }

      if (activeTool === 'draw') {
        drawPointsRef.current.push(pointer);
        const points = drawPointsRef.current;

        // Build SVG path string from collected points
        let pathData = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          pathData += ` L ${points[i].x} ${points[i].y}`;
        }

        const path = new fabric.Path(pathData, {
          stroke: activeColor,
          strokeWidth: 2,
          fill: 'transparent',
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          selectable: false,
          evented: false,
          hasBorders: false,
          hasControls: false,
        });

        tempObjectRef.current = path;
        canvas.add(path);
        canvas.discardActiveObject();
      } else if (activeTool === 'arrow') {
        // Clamp arrow endpoint to keep it inside canvas
        const headLength = 15;
        const clampedEndX = Math.max(headLength / 2, Math.min(pointer.x, width - headLength / 2));
        const angle = Math.atan2(pointer.y - start.y, clampedEndX - start.x);

        const line = new fabric.Line([start.x, start.y, clampedEndX, pointer.y], {
          stroke: activeColor,
          strokeWidth: 2,
          selectable: false,
        });

        const triangle = new fabric.Triangle({
          left: clampedEndX,
          top: pointer.y,
          width: headLength,
          height: headLength,
          fill: activeColor,
          angle: (angle * 180) / Math.PI + 90,
          originX: 'center',
          originY: 'center',
          selectable: false,
        });

        const group = new fabric.Group([line, triangle], {
          selectable: false,
          evented: false,
          hasBorders: false,
          hasControls: false,
        });

        tempObjectRef.current = group;
        canvas.add(group);
        canvas.discardActiveObject();
      } else if (activeTool === 'box') {
        const strokeWidth = 2;
        // Clamp coordinates to keep stroke inside canvas
        const clampedStartX = Math.max(strokeWidth / 2, Math.min(start.x, width - strokeWidth / 2));
        const clampedPointerX = Math.max(strokeWidth / 2, Math.min(pointer.x, width - strokeWidth / 2));

        const left = Math.min(clampedStartX, clampedPointerX);
        const top = Math.min(start.y, pointer.y);
        const rectWidth = Math.abs(clampedPointerX - clampedStartX);
        const rectHeight = Math.abs(pointer.y - start.y);

        const rect = new fabric.Rect({
          left,
          top,
          width: rectWidth || 1,
          height: rectHeight || 1,
          fill: 'transparent',
          stroke: activeColor,
          strokeWidth: 2,
          strokeUniform: true,
          originX: 'left',
          originY: 'top',
          selectable: false,
          evented: false,
          hasBorders: false,
          hasControls: false,
        });

        tempObjectRef.current = rect;
        canvas.add(rect);
        canvas.discardActiveObject();
      }

      canvas.requestRenderAll();
    };

    const handleMouseUp = (opt) => {
      if (!isDrawingRef.current) return;

      isDrawingRef.current = false;
      const startPoint = startPointRef.current;
      startPointRef.current = null;
      drawPointsRef.current = [];

      // Re-enable selection
      canvas.selection = true;

      if (tempObjectRef.current) {
        const obj = tempObjectRef.current;

        // Check if arrow is too short (minimum 25px length for visible body)
        if (obj.type === 'group' && startPoint) {
          const rawPointer = opt.scenePoint || opt.pointer;
          const endPoint = {
            x: Math.max(0, Math.min(rawPointer.x, width)),
            y: Math.max(0, Math.min(rawPointer.y, height)),
          };
          const length = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) +
            Math.pow(endPoint.y - startPoint.y, 2)
          );
          const minArrowLength = 25;

          if (length < minArrowLength) {
            // Arrow too short - remove it
            canvas.remove(obj);
            tempObjectRef.current = null;
            canvas.requestRenderAll();
            return;
          }
        }

        // Check if rectangle is too small (minimum 10px on both dimensions)
        if (obj.type === 'rect') {
          const minRectSize = 10;
          if (obj.width < minRectSize && obj.height < minRectSize) {
            // Rectangle too small - remove it
            canvas.remove(obj);
            tempObjectRef.current = null;
            canvas.requestRenderAll();
            return;
          }
        }

        // Check if free-drawn path is too small
        if (obj.type === 'path') {
          const bounds = obj.getBoundingRect();
          if (bounds.width < 10 && bounds.height < 10) {
            canvas.remove(obj);
            tempObjectRef.current = null;
            canvas.requestRenderAll();
            return;
          }
        }

        // Make the object selectable and interactive now that drawing is complete
        obj.selectable = true;
        obj.evented = true;
        obj.hasBorders = true;
        obj.hasControls = true;
        obj.setCoords();

        tempObjectRef.current = null;
        // Deselect to hide the selection box
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        saveToHistory();
      }
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    // Constrain objects to canvas boundaries when moving
    const handleObjectMoving = (opt) => {
      const obj = opt.target;
      const boundingRect = obj.getBoundingRect();

      // Constrain left edge
      if (boundingRect.left < 0) {
        obj.left = obj.left - boundingRect.left;
      }
      // Constrain right edge
      if (boundingRect.left + boundingRect.width > width) {
        obj.left = obj.left - (boundingRect.left + boundingRect.width - width);
      }
      // Constrain top edge
      if (boundingRect.top < 0) {
        obj.top = obj.top - boundingRect.top;
      }
      // Constrain bottom edge
      if (boundingRect.top + boundingRect.height > height) {
        obj.top = obj.top - (boundingRect.top + boundingRect.height - height);
      }

      obj.setCoords();
    };
    canvas.on('object:moving', handleObjectMoving);

    // Constrain objects to canvas boundaries when scaling
    const handleObjectScaling = (opt) => {
      const obj = opt.target;
      const boundingRect = obj.getBoundingRect();

      let constrained = false;

      // If scaling would push object outside boundaries, limit the scale
      if (boundingRect.left < 0 || boundingRect.left + boundingRect.width > width ||
          boundingRect.top < 0 || boundingRect.top + boundingRect.height > height) {

        // Calculate maximum allowed scale
        const maxScaleX = Math.min(
          obj.left / (obj.width / 2 * (obj.originX === 'center' ? 1 : 0) || 1),
          (width - obj.left) / (obj.width / 2 || 1)
        );
        const maxScaleY = Math.min(
          obj.top / (obj.height / 2 * (obj.originY === 'center' ? 1 : 0) || 1),
          (height - obj.top) / (obj.height / 2 || 1)
        );

        // Clamp to boundaries
        if (boundingRect.left < 0) {
          obj.left = obj.left - boundingRect.left;
          constrained = true;
        }
        if (boundingRect.left + boundingRect.width > width) {
          obj.left = obj.left - (boundingRect.left + boundingRect.width - width);
          constrained = true;
        }
        if (boundingRect.top < 0) {
          obj.top = obj.top - boundingRect.top;
          constrained = true;
        }
        if (boundingRect.top + boundingRect.height > height) {
          obj.top = obj.top - (boundingRect.top + boundingRect.height - height);
          constrained = true;
        }
      }

      if (constrained) {
        obj.setCoords();
      }
    };
    canvas.on('object:scaling', handleObjectScaling);

    // Save when objects are modified
    canvas.on('object:modified', saveToHistory);

    // Save when text editing is finished
    const handleTextEditEnd = (e) => {
      const textbox = e.target;
      // Remove empty text annotations
      if (textbox && (!textbox.text || textbox.text.trim() === '')) {
        canvas.remove(textbox);
        canvas.requestRenderAll();
      } else {
        saveToHistory();
      }
      // Flag to consume the next click instead of creating new text
      justExitedTextEditRef.current = true;
    };
    canvas.on('text:editing:exited', handleTextEditEnd);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('object:scaling', handleObjectScaling);
      canvas.off('object:modified', saveToHistory);
      canvas.off('text:editing:exited', handleTextEditEnd);
    };
  }, [activeTool, activeColor, saveToHistory, readOnly, width, height, canvasReady]);

  // Update color of selected objects when activeColor changes
  useEffect(() => {
    if (!fabricRef.current || readOnly) return;

    const canvas = fabricRef.current;
    const activeObjects = canvas.getActiveObjects();

    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => {
        if (obj.type === 'group') {
          // Arrow: update line stroke and triangle fill
          obj.getObjects().forEach((child) => {
            if (child.type === 'line') {
              child.set('stroke', activeColor);
            } else if (child.type === 'triangle') {
              child.set('fill', activeColor);
            }
          });
        } else if (obj.type === 'rect') {
          // Box: update stroke
          obj.set('stroke', activeColor);
        } else if (obj.type === 'textbox') {
          // Text: update fill
          obj.set('fill', activeColor);
        } else if (obj.type === 'path') {
          // Free-drawn line: update stroke
          obj.set('stroke', activeColor);
        }
      });
      canvas.requestRenderAll();
      saveToHistory();
    }
  }, [activeColor, readOnly, saveToHistory]);

  // Handle Delete key to remove selected objects
  useEffect(() => {
    if (!fabricRef.current || readOnly) return;

    const canvas = fabricRef.current;

    const handleKeyDown = (e) => {
      // Don't delete when editing text
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          e.preventDefault();
          activeObjects.forEach((obj) => canvas.remove(obj));
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          saveToHistory();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveToHistory, readOnly]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ touchAction: 'pan-y pan-x' }}
    />
  );
});
