import { Handle } from '@xyflow/react';
import { Position } from './entity.enum'
import './load-more-node.less';

const getHandle = (
    isConnectable,
    id
  ) => {
    return (
      <>
        <Handle
          className="load-more-handle"
          id={id}
          isConnectable={isConnectable}
          position={Position.Left}
          type="target"
        />
        <Handle
          className="load-more-handle"
          id={id}
          isConnectable={isConnectable}
          position={Position.Right}
          type="source"
        />
      </>
    );
  };

const LoadMoreNode = (props) => {
    const { data } = props;
    const { node } = data;

    return (
        <div className="load-more-node w-76" data-testid="node-label">
        {getHandle(false)}
        {node.displayName ?? node.name}
        </div>
    );
}

export default LoadMoreNode