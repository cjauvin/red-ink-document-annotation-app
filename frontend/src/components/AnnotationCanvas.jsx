import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
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
  readOnly = false,
}, ref) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef(null);
  const tempObjectRef = useRef(null);
  const tempLineRef = useRef(null);      // For arrow drawing optimization
  const tempTriangleRef = useRef(null);  // For arrow drawing optimization
  const historyRef = useRef([]);
  const currentScaleRef = useRef(scale);
  const justExitedTextEditRef = useRef(false);

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

  // Normalize annotation data to scale=1 for storage
  const normalizeData = useCallback((json) => {
    if (!json || !json.objects || currentScaleRef.current === 1) return json;

    const s = currentScaleRef.current;
    return {
      ...json,
      objects: json.objects.map((obj) => ({
        ...obj,
        left: obj.left / s,
        top: obj.top / s,
        scaleX: (obj.scaleX || 1) / s,
        scaleY: (obj.scaleY || 1) / s,
      })),
    };
  }, []);

  // Expose undo and clear methods to parent
  useImperativeHandle(ref, () => ({
    undo: () => {
      if (!fabricRef.current || historyRef.current.length <= 1) return;

      historyRef.current.pop();
      const previousState = historyRef.current[historyRef.current.length - 1];

      fabricRef.current.clear();
      if (previousState.objects && previousState.objects.length > 0) {
        fabric.util.enlivenObjects(previousState.objects).then((objects) => {
          objects.forEach((obj) => {
            configureTextbox(obj);
            fabricRef.current.add(obj);
          });
          fabricRef.current.renderAll();
        });
      }

      onHistoryChange?.(historyRef.current.length > 1);
      // Normalize before sending to parent
      onCanvasChange?.(normalizeData(previousState));
    },
    clear: () => {
      if (!fabricRef.current) return;

      fabricRef.current.clear();
      const json = fabricRef.current.toJSON();
      historyRef.current.push(json);
      onHistoryChange?.(historyRef.current.length > 1);
      // Normalize before sending to parent (though clear is already empty)
      onCanvasChange?.(normalizeData(json));
    },
  }), [onCanvasChange, onHistoryChange, normalizeData, configureTextbox]);

  // Denormalize annotation data from scale=1 to current scale
  const denormalizeData = useCallback((json, targetScale) => {
    if (!json || !json.objects || targetScale === 1) return json;

    return {
      ...json,
      objects: json.objects.map((obj) => ({
        ...obj,
        left: obj.left * targetScale,
        top: obj.top * targetScale,
        scaleX: (obj.scaleX || 1) * targetScale,
        scaleY: (obj.scaleY || 1) * targetScale,
      })),
    };
  }, []);

  // Initialize canvas once on mount
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      selection: !readOnly,
      isDrawingMode: false,
      enableRetinaScaling: false,
      renderOnAddRemove: false,  // Prevent auto-render on add/remove for performance
    });

    fabricRef.current = canvas;
    currentScaleRef.current = scale;

    // Load initial data immediately after canvas creation
    if (initialData && initialData.objects && initialData.objects.length > 0) {
      // Denormalize from scale=1 to current scale
      const denormalized = denormalizeData(initialData, scale);

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
        onHistoryChange?.(historyRef.current.length > 1);
      });
    } else {
      historyRef.current = [canvas.toJSON()];
      onHistoryChange?.(false);
    }

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - initialData is captured at creation time

  // Update canvas size and scale objects when zoom changes
  useEffect(() => {
    if (!fabricRef.current || !width || !height) return;

    const canvas = fabricRef.current;
    const prevScale = currentScaleRef.current;
    const newScale = scale;

    // Update canvas dimensions
    canvas.setDimensions({ width, height });

    // Scale all objects if scale changed
    if (prevScale !== newScale && prevScale > 0) {
      const scaleFactor = newScale / prevScale;

      canvas.getObjects().forEach((obj) => {
        // Scale position
        obj.left *= scaleFactor;
        obj.top *= scaleFactor;

        // Scale size
        obj.scaleX *= scaleFactor;
        obj.scaleY *= scaleFactor;

        obj.setCoords();
      });

      // Update history with scaled state
      historyRef.current = [canvas.toJSON()];
    }

    currentScaleRef.current = newScale;
    canvas.renderAll();
  }, [width, height, scale]);

  // Save canvas state to history
  const saveToHistory = useCallback(() => {
    if (!fabricRef.current) return;

    const json = fabricRef.current.toJSON();
    historyRef.current.push(json);
    onHistoryChange?.(historyRef.current.length > 1);

    // Normalize before sending to parent (store at scale=1)
    const normalizedJson = normalizeData(json);
    onCanvasChange?.(normalizedJson);
  }, [onCanvasChange, onHistoryChange, normalizeData]);

  // Handle mouse events for drawing
  useEffect(() => {
    if (!fabricRef.current || readOnly) return;

    const canvas = fabricRef.current;

    const handleMouseDown = (opt) => {
      if (!activeTool || activeTool === 'select') return;

      // Don't start drawing if clicking on an existing object (allow selection/resize)
      if (opt.target) return;

      // Fabric.js v6 uses scenePoint instead of getPointer
      const rawPointer = opt.scenePoint || opt.pointer;
      // Clamp x coordinate to canvas boundaries (0 to width)
      const pointer = {
        x: Math.max(0, Math.min(rawPointer.x, width)),
        y: rawPointer.y,
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
        const textWidth = 150;
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
    };

    const handleMouseMove = (opt) => {
      if (!isDrawingRef.current || !startPointRef.current) return;
      if (activeTool === 'text') return;

      // Fabric.js v6 uses scenePoint instead of getPointer
      const rawPointer = opt.scenePoint || opt.pointer;
      // Clamp x coordinate to canvas boundaries (0 to width)
      const pointer = {
        x: Math.max(0, Math.min(rawPointer.x, width)),
        y: rawPointer.y,
      };
      const start = startPointRef.current;

      if (activeTool === 'arrow') {
        const headLength = 15;
        const clampedEndX = Math.max(headLength / 2, Math.min(pointer.x, width - headLength / 2));
        const angle = Math.atan2(pointer.y - start.y, clampedEndX - start.x);

        if (tempLineRef.current && tempTriangleRef.current) {
          // Update existing objects instead of recreating
          tempLineRef.current.set({ x2: clampedEndX, y2: pointer.y });
          tempTriangleRef.current.set({
            left: clampedEndX,
            top: pointer.y,
            angle: (angle * 180) / Math.PI + 90,
          });
        } else {
          // First mouse move - create the objects
          const line = new fabric.Line([start.x, start.y, clampedEndX, pointer.y], {
            stroke: activeColor,
            strokeWidth: 2,
            selectable: false,
            evented: false,
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
            evented: false,
          });

          tempLineRef.current = line;
          tempTriangleRef.current = triangle;
          canvas.add(line);
          canvas.add(triangle);
        }
      } else if (activeTool === 'box') {
        const strokeWidth = 2;
        const clampedStartX = Math.max(strokeWidth / 2, Math.min(start.x, width - strokeWidth / 2));
        const clampedPointerX = Math.max(strokeWidth / 2, Math.min(pointer.x, width - strokeWidth / 2));

        const left = Math.min(clampedStartX, clampedPointerX);
        const top = Math.min(start.y, pointer.y);
        const rectWidth = Math.abs(clampedPointerX - clampedStartX);
        const rectHeight = Math.abs(pointer.y - start.y);

        if (tempObjectRef.current) {
          // Update existing rect instead of recreating
          tempObjectRef.current.set({
            left,
            top,
            width: rectWidth || 1,
            height: rectHeight || 1,
          });
        } else {
          // First mouse move - create the rect
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
        }
      }

      canvas.requestRenderAll();
    };

    const handleMouseUp = (opt) => {
      if (!isDrawingRef.current) return;

      isDrawingRef.current = false;
      const startPoint = startPointRef.current;
      startPointRef.current = null;

      // Re-enable selection
      canvas.selection = true;

      // Handle arrow completion - group line and triangle
      if (tempLineRef.current && tempTriangleRef.current) {
        const rawPointer = opt.scenePoint || opt.pointer;
        const endPoint = {
          x: Math.max(0, Math.min(rawPointer.x, width)),
          y: rawPointer.y,
        };
        const length = Math.sqrt(
          Math.pow(endPoint.x - startPoint.x, 2) +
          Math.pow(endPoint.y - startPoint.y, 2)
        );
        const minArrowLength = 25;

        if (length < minArrowLength) {
          // Arrow too short - remove it
          canvas.remove(tempLineRef.current);
          canvas.remove(tempTriangleRef.current);
          tempLineRef.current = null;
          tempTriangleRef.current = null;
          canvas.requestRenderAll();
          return;
        }

        // Remove individual objects and create group
        canvas.remove(tempLineRef.current);
        canvas.remove(tempTriangleRef.current);

        const group = new fabric.Group([tempLineRef.current, tempTriangleRef.current], {
          selectable: true,
          evented: true,
          hasBorders: true,
          hasControls: true,
        });
        group.setCoords();
        canvas.add(group);

        tempLineRef.current = null;
        tempTriangleRef.current = null;

        canvas.discardActiveObject();
        canvas.requestRenderAll();
        saveToHistory();
        return;
      }

      // Handle box completion
      if (tempObjectRef.current) {
        const obj = tempObjectRef.current;

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

    // Constrain objects to horizontal boundaries when moving
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

      obj.setCoords();
    };
    canvas.on('object:moving', handleObjectMoving);

    // Save when objects are modified
    canvas.on('object:modified', saveToHistory);

    // Save when text editing is finished
    const handleTextEditEnd = () => {
      saveToHistory();
      // Flag to consume the next click instead of creating new text
      justExitedTextEditRef.current = true;
    };
    canvas.on('text:editing:exited', handleTextEditEnd);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('object:modified', saveToHistory);
      canvas.off('text:editing:exited', handleTextEditEnd);
    };
  }, [activeTool, activeColor, saveToHistory, readOnly, width]);

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
    />
  );
});
