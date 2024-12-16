import { useLineageProvider } from './LineageProvider'
import { getBezierPath } from '@xyflow/react'
import { Fragment } from 'react'
import { getColumnSourceTargetHandles, decodeLineageHandles } from './lineageUtils'
import { FOREIGN_OBJECT_SIZE } from './entity.enum'
import { Tooltip } from 'antd'

// 连接线自定义加工字段
export const LineageEdgeIcon = ({
    children,
    x,
    y,
    offset,
  }) => {
    return (
      <foreignObject
        height={FOREIGN_OBJECT_SIZE / 2}
        requiredExtensions="http://www.w3.org/1999/xhtml"
        width={FOREIGN_OBJECT_SIZE / 2}
        x={x - FOREIGN_OBJECT_SIZE / offset}
        y={y - FOREIGN_OBJECT_SIZE / offset}>
        {children}
      </foreignObject>
    );
};


const CustomEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
    selected
}) => {
  // 连接线数据 
  const {
      edge,
      isColumnLineage,
      sourceHandle,
      targetHandle,
      isPipelineRootNode,
      fromColumns,
      ...rest
    } = data;
    
  const offset = 4;

  const { fromEntity, toEntity, pipeline, pipelineEntityType } = data?.edge ?? {};

  const theme = {
      primaryColor: '#0968da',
      infoColor: '#2196f3',
      successColor: '#008376',
      warningColor: '#ffc34e',
      errorColor: '#ff4c3b',
  };

  const {
      tracedNodes,
      tracedColumns,
      onColumnHighlight
  } = useLineageProvider();

  const [edgePath, edgeCenterX, edgeCenterY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    const [invisibleEdgePath] = getBezierPath({
      sourceX: sourceX + offset,
      sourceY: sourceY + offset,
      sourcePosition,
      targetX: targetX + offset,
      targetY: targetY + offset,
      targetPosition,
    });
    const [invisibleEdgePath1] = getBezierPath({
      sourceX: sourceX - offset,
      sourceY: sourceY - offset,
      sourcePosition,
      targetX: targetX - offset,
      targetY: targetY - offset,
      targetPosition,
    });

    const getInvisiblePath = (path) => {
      return (
        <path
          className="react-flow__edge-path"
          d={path}
          data-testid="react-flow-edge-path"
          id={id}
          markerEnd={markerEnd}
          style={{ ...style, strokeWidth: '6px', opacity: 0 }}
        />
      );
    };

    const isColumnHighlighted = () => {
      if (!isColumnLineage) {
        return false;
      }
  
      const decodedHandles = getColumnSourceTargetHandles({
        sourceHandle,
        targetHandle,
      });
  
      return (
        tracedColumns.includes(decodedHandles.sourceHandle ?? '') &&
        tracedColumns.includes(decodedHandles.targetHandle ?? '')
      );
    }

      // 连接线高亮样式
    const updatedStyle = () => {
        const isNodeTraced =
          tracedNodes.includes(edge.fromEntity.id) &&
          tracedNodes.includes(edge.toEntity.id);
    
        let isStrokeNeeded = isNodeTraced;
    
        if (isColumnLineage) {
          isStrokeNeeded = isColumnHighlighted();
        }
    
        return {
          ...style,
          ...{
            stroke: isStrokeNeeded ? theme.primaryColor : undefined,
          },
        };
    }

    return (
        <Fragment>
            <path
                className="react-flow__edge-path"
                d={edgePath}
                id={id}
                markerEnd={markerEnd}
                style={updatedStyle()}
            />
            {/* {getInvisiblePath(invisibleEdgePath)}
            {getInvisiblePath(invisibleEdgePath1)} */}
            {
                fromColumns?.length ? (
                    <LineageEdgeIcon offset={4} x={edgeCenterX} y={edgeCenterY}>
                        <Tooltip title={`CONCAT(${fromColumns?.toString()})`}>
                            <span 
                                style={{
                                    width: 20, 
                                    height: 20, 
                                    display: 'inline-block',
                                    background: '#1890FF', 
                                    borderRadius: '10px'
                                }}
                                onMouseEnter={() => {
                                    const fullyQualifiedName = decodeLineageHandles(sourceHandle)
                                    const targetHandleFullyQualifiedName = decodeLineageHandles(targetHandle)
                                    onColumnHighlight(fullyQualifiedName ?? '', targetHandleFullyQualifiedName ?? '')
                                }}
                                onMouseLeave={() => {
                                    onColumnHighlight()
                                }}
                            />
                        </Tooltip>
                    </LineageEdgeIcon>
                ) : null
            }
        </Fragment>
    )
}

export default CustomEdge